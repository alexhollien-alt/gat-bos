/**
 * Phase 9 PROD auth helper -- targets https://gat-bos.vercel.app.
 *
 * Mirrors phase-9-auth-helper.mjs but pins SITE to the prod URL regardless of
 * NEXT_PUBLIC_SITE_URL in .env.local (which may point at localhost). Supabase
 * URL / anon / service keys are reused -- same Supabase project for dev + prod.
 *
 * Exports: ensureAuthState(statePath) -> Promise<string>, loadEnv()
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const PROD_SITE = 'https://gat-bos.vercel.app';

export function loadEnv() {
  const envPath = resolve(homedir(), 'crm', '.env.local');
  const env = Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      })
  );
  const URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !ANON || !SERVICE) throw new Error('Missing Supabase env vars in ~/crm/.env.local');
  const SITE = process.env.SITE || PROD_SITE;
  const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || null;
  return { URL, ANON, SERVICE, SITE, BYPASS };
}

export function bypassHeaders() {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return secret ? { 'x-vercel-protection-bypass': secret } : {};
}

const ALEX_EMAIL = 'alex@alexhollienco.com';
const AUTH_MAX_AGE_MS = 1000 * 60 * 30;

export async function ensureAuthState(statePath) {
  if (existsSync(statePath)) {
    const ageMs = Date.now() - statSync(statePath).mtimeMs;
    if (ageMs < AUTH_MAX_AGE_MS) return statePath;
  }
  const { URL, ANON, SERVICE, SITE, BYPASS } = loadEnv();
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const extraHTTPHeaders = BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : undefined;

  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);
  const alex = listed?.users?.find((u) => u.email === ALEX_EMAIL);
  if (!alex) throw new Error(`User ${ALEX_EMAIL} not found in Supabase auth`);

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: ALEX_EMAIL,
    options: { redirectTo: `${SITE}/login` },
  });
  if (linkErr || !link?.properties?.action_link) {
    throw new Error(`generateLink failed: ${linkErr?.message ?? 'no action_link'}`);
  }
  const hashedToken = link.properties.hashed_token;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(extraHTTPHeaders ? { extraHTTPHeaders } : {});
  const page = await context.newPage();

  await page.goto(`${SITE}/login`, { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async ({ URL, ANON, tokenHash }) => {
    try {
      const mod = await import('https://esm.sh/@supabase/ssr@0.9');
      const client = mod.createBrowserClient(URL, ANON);
      const { data, error } = await client.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      });
      return { hasSession: !!data?.session, error: error?.message ?? null, cookieString: document.cookie };
    } catch (err) {
      return { hasSession: false, error: `evaluate exception: ${err?.message ?? String(err)}` };
    }
  }, { URL, ANON, tokenHash: hashedToken });
  if (!result.hasSession) throw new Error(`verifyOtp failed: ${result.error}`);
  await page.waitForTimeout(500);

  await page.goto(`${SITE}/today`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {});
  if (page.url().includes('/login')) {
    throw new Error('Auth did not stick -- /today still redirected to /login after magic-link flow');
  }

  await context.storageState({ path: statePath });
  await browser.close();
  return statePath;
}
