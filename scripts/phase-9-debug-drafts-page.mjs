import { chromium } from 'playwright';
import { ensureAuthState, loadEnv } from './phase-9-auth-helper.mjs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const STATE = resolve(tmpdir(), 'phase-9-auth-state.json');
const { SITE } = loadEnv();
await ensureAuthState(STATE);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: STATE });
const page = await ctx.newPage();

const reqs = [];
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('supabase.co') || u.includes('/api/')) {
    reqs.push({ method: req.method(), url: u.slice(0, 180) });
  }
});
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`${SITE}/drafts`, { waitUntil: 'load' });
await page.waitForTimeout(5000);
console.log(`Captured ${reqs.length} requests on /drafts:`);
for (const r of reqs) console.log(`  ${r.method} ${r.url}`);

console.log('\n--- now /today ---');
reqs.length = 0;
await page.goto(`${SITE}/today`, { waitUntil: 'load' });
await page.waitForTimeout(5000);
console.log(`Captured ${reqs.length} requests on /today:`);
for (const r of reqs) console.log(`  ${r.method} ${r.url}`);

await browser.close();
