/** Debug: see what /today actually renders */
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

page.on('console', (msg) => console.log(`[page:${msg.type()}]`, msg.text()));
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`${SITE}/today`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

const h2s = await page.locator('h2').allTextContents();
console.log('h2s:', h2s);

const draftSection = page.locator('section').filter({ has: page.locator('h2:has-text("Pending drafts")') });
const exists = await draftSection.count();
console.log('Pending drafts sections:', exists);
if (exists > 0) {
  const textContent = await draftSection.first().textContent();
  console.log('Section text:', textContent?.slice(0, 300));
}

await page.screenshot({ path: '/tmp/phase-9-today.png', fullPage: true });
console.log('Screenshot saved to /tmp/phase-9-today.png');
await browser.close();
