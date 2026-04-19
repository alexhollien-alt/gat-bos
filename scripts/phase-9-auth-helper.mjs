/**
 * Shared auth helper for Phase 9 gate scripts.
 *
 * Mints a Supabase magic-link for alex@alexhollienco.com via the service role,
 * lets Playwright visit the link so the app sets Supabase session cookies,
 * then saves the full storage state to a JSON path the other scripts read.
 *
 * Exports: ensureAuthState(statePath) -> Promise<string>
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

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
  const SITE = env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  if (!URL || !ANON || !SERVICE) throw new Error('Missing Supabase env vars in ~/crm/.env.local');
  return { URL, ANON, SERVICE, SITE };
}

const ALEX_EMAIL = 'alex@alexhollienco.com';
const AUTH_MAX_AGE_MS = 1000 * 60 * 30; // 30 min

export async function ensureAuthState(statePath) {
  if (existsSync(statePath)) {
    const ageMs = Date.now() - statSync(statePath).mtimeMs;
    if (ageMs < AUTH_MAX_AGE_MS) return statePath;
  }
  const { URL, ANON, SERVICE, SITE } = loadEnv();
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  // Verify the target user exists; bail loudly if not.
  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);
  const alex = listed?.users?.find((u) => u.email === ALEX_EMAIL);
  if (!alex) throw new Error(`User ${ALEX_EMAIL} not found in Supabase auth`);

  // redirect_to MUST be a public page (not gated by middleware), so the app's JS gets
  // a chance to run and parse the URL fragment before a redirect-to-login kicks in.
  // /login is public; @supabase/ssr's browser client will read the fragment, set cookies,
  // then we'll navigate to /today.
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
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the app FIRST (any public page works). This seeds the document origin
  // so @supabase/ssr's browser client can write cookies to the right domain.
  await page.goto(`${SITE}/login`, { waitUntil: 'domcontentloaded' });

  // Call verifyOtp from the page. We construct a fresh @supabase/ssr browser client via
  // esm.sh so we don't need the app to expose its client. The client's cookie adapter
  // writes `sb-<ref>-auth-token*` cookies to document.cookie during the verify call.
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

  // Confirm a protected route now loads.
  await page.goto(`${SITE}/today`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 10000 }).catch(() => {});
  if (page.url().includes('/login')) {
    throw new Error('Auth did not stick -- /today still redirected to /login after magic-link flow');
  }

  await context.storageState({ path: statePath });
  await browser.close();
  return statePath;
}

export function cookieHeaderFromState(statePath, originHost) {
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  const host = new globalThis.URL(originHost).hostname;
  const matching = state.cookies.filter((c) => c.domain === host || host.endsWith(c.domain.replace(/^\./, '')));
  return matching.map((c) => `${c.name}=${c.value}`).join('; ');
}
