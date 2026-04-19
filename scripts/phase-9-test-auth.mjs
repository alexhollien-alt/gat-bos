/** Quick test harness: prove the magic-link auth flow works. */
import { ensureAuthState, loadEnv } from './phase-9-auth-helper.mjs';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const STATE = resolve(tmpdir(), 'phase-9-auth-state.json');
const { SITE } = loadEnv();

console.log('Minting magic link and capturing auth state...');
await ensureAuthState(STATE);
console.log(`Storage state saved to ${STATE}`);

console.log('Verifying /today loads authenticated...');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: STATE });
const page = await context.newPage();
const response = await page.goto(`${SITE}/today`, { waitUntil: 'domcontentloaded' });
const url = page.url();
console.log(`HTTP status: ${response.status()}  URL: ${url}`);
if (!url.endsWith('/today')) {
  console.error('FAIL: was redirected away from /today -> auth did not stick');
  await browser.close();
  process.exit(1);
}
// Wait a moment for React to hydrate and Today cards to render
await page.waitForTimeout(3000);
const h1Count = await page.locator('h1').count();
console.log(`/today rendered; h1 count=${h1Count}`);
await browser.close();
console.log('PASS');
