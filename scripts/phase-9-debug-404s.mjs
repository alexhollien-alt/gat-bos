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

const fails = [];
page.on('response', (res) => {
  if (res.status() >= 400) fails.push({ status: res.status(), url: res.url() });
});
page.on('requestfailed', (req) => {
  fails.push({ status: 'failed', url: req.url(), err: req.failure()?.errorText });
});

await page.goto(`${SITE}/today`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

console.log(`Captured ${fails.length} failed responses:`);
for (const f of fails) console.log(`  [${f.status}] ${f.url} ${f.err || ''}`);

await browser.close();
