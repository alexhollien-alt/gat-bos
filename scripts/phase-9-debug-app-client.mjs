import { chromium } from 'playwright';
import { ensureAuthState, loadEnv } from './phase-9-auth-helper.mjs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const STATE = resolve(tmpdir(), 'phase-9-auth-state.json');
const { SITE, URL, ANON } = loadEnv();
await ensureAuthState(STATE);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: STATE });
const page = await ctx.newPage();

const allReqs = [];
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('supabase.co') || u.includes('realtime') || u.includes('ws://') || u.includes('wss://')) {
    allReqs.push({ method: req.method(), url: u.slice(0, 200), time: Date.now() });
  }
});

await page.goto(`${SITE}/today`, { waitUntil: 'load' });
console.log('Waiting 8 seconds for all queries to fire...');
await page.waitForTimeout(8000);

console.log(`\nCaptured ${allReqs.length} Supabase requests:`);
for (const r of allReqs) console.log(`  ${r.method} ${r.url.slice(0, 150)}`);

// Tap React/TanStack state via injected probe
const tanstackState = await page.evaluate(() => {
  const qc = window.__TANSTACK_QUERY_CLIENT__ || null;
  return { hasClient: !!qc, qcType: typeof qc };
});
console.log('\nTanStack client on window:', tanstackState);

await browser.close();
