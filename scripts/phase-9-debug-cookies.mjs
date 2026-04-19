import { chromium } from 'playwright';
import { ensureAuthState, loadEnv } from './phase-9-auth-helper.mjs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';

const STATE = resolve(tmpdir(), 'phase-9-auth-state.json');
const { SITE, URL, ANON } = loadEnv();
await ensureAuthState(STATE);

const state = JSON.parse(readFileSync(STATE, 'utf8'));
console.log('Cookies in state:');
for (const c of state.cookies) {
  console.log(`  ${c.name} (domain=${c.domain}, path=${c.path}, len=${c.value.length})`);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: STATE });
const page = await ctx.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') console.log(`[page:${msg.type()}]`, msg.text());
});
page.on('request', (req) => {
  if (req.url().includes('supabase.co')) console.log(`[req] ${req.method()} ${req.url().slice(0, 150)}`);
});
page.on('response', (res) => {
  if (res.url().includes('supabase.co')) console.log(`[res ${res.status()}] ${res.url().slice(0, 150)}`);
});

await page.goto(`${SITE}/today`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

const result = await page.evaluate(async ({ URL, ANON }) => {
  // Try to run the exact same query from the browser context using a fresh client.
  const mod = await import('https://esm.sh/@supabase/ssr@0.9');
  const client = mod.createBrowserClient(URL, ANON);
  const { data: session } = await client.auth.getSession();
  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from('email_drafts')
    .select('id, draft_subject, status, email:emails!inner (from_email)')
    .in('status', ['generated', 'approved', 'revised'])
    .gt('expires_at', nowIso)
    .limit(10);
  return {
    sessionUserId: session?.session?.user?.id ?? null,
    sessionEmail: session?.session?.user?.email ?? null,
    error: error?.message ?? null,
    rowCount: data?.length ?? 0,
    cookieString: document.cookie.slice(0, 200),
  };
}, { URL, ANON });

console.log('\nIn-page query result:');
console.log(JSON.stringify(result, null, 2));

await browser.close();
