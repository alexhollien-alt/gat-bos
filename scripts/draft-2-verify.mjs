// Visual verification of Draft 2 capture bar on /today and /captures.
// Reuses Phase 9 auth helper. Outputs two screenshots to ~/Desktop.
import { chromium } from 'playwright';
import { ensureAuthState, loadEnv } from './phase-9-auth-helper.mjs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const STATE = '/tmp/capture-bar-auth-state.json';
const DESKTOP = resolve(homedir(), 'Desktop');

async function main() {
  const { SITE } = loadEnv();
  await ensureAuthState(STATE);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Warm the dev server so on-demand compile finishes before we screenshot.
  // First request to /today triggers JIT Tailwind + route compile which can take 10-15s.
  await page.goto(`${SITE}/today`, { waitUntil: 'load' });
  await page.waitForSelector('input[aria-label="Universal capture"]', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(8000); // let Next.js finish dev compile + Fast Refresh settle
  // Force reload to pick up fully-compiled CSS.
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('input[aria-label="Universal capture"]', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${DESKTOP}/draft-2-today.png`, fullPage: false });

  // Type to trigger the live preview line.
  const input = page.locator('input[aria-label="Universal capture"]');
  await input.click();
  await input.fill('Met with Julie Jarmiolowski at Optima yesterday');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DESKTOP}/draft-2-today-preview.png`, fullPage: false });

  // Clear and navigate to /captures (first time compiles the route).
  await input.fill('');
  await page.goto(`${SITE}/captures`, { waitUntil: 'load' });
  await page.waitForSelector('h1', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(6000);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('h1', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${DESKTOP}/draft-2-captures.png`, fullPage: false });

  console.log('SHOT today:', `${DESKTOP}/draft-2-today.png`);
  console.log('SHOT today-preview:', `${DESKTOP}/draft-2-today-preview.png`);
  console.log('SHOT captures:', `${DESKTOP}/draft-2-captures.png`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
