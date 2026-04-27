/**
 * Phase 008 smoke: load /today-v2 against local dev (port 3000),
 * verify page renders without console errors and key lane headers
 * are present in the DOM. Read-only; no mutations.
 */
import { chromium } from 'playwright';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { ensureAuthState } from './phase-9-auth-helper.mjs';

const SITE = 'http://localhost:3000';
const STATE_PATH = resolve(tmpdir(), 'phase-008-auth-state.json');

const REQUIRED_HEADERS = ['Calls & Follow-ups', 'Priority Runway', 'Listing Activity'];

async function main() {
  await ensureAuthState(STATE_PATH);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const resp = await page.goto(`${SITE}/today-v2`, { waitUntil: 'networkidle', timeout: 30000 });
  const status = resp?.status() ?? 0;
  const url = page.url();

  await page.waitForTimeout(1500);

  const headerHits = {};
  for (const h of REQUIRED_HEADERS) {
    headerHits[h] = await page.locator(`h2:has-text("${h}")`).count();
  }

  const lcMatches = await page.locator('text=Lifecycle').count();
  const screenshot = resolve(process.cwd(), '.playwright-cli', 'phase-008-today-v2.png');
  await page.screenshot({ path: screenshot, fullPage: true });

  await browser.close();

  const result = {
    status,
    finalUrl: url,
    headerHits,
    consoleErrors,
    pageErrors,
    screenshot,
  };

  console.log(JSON.stringify(result, null, 2));

  const missing = Object.entries(headerHits).filter(([, c]) => c === 0).map(([h]) => h);
  const ok =
    status === 200 &&
    url.includes('/today-v2') &&
    missing.length === 0 &&
    consoleErrors.length === 0 &&
    pageErrors.length === 0;

  if (!ok) {
    console.error('\nSMOKE FAIL:');
    if (status !== 200) console.error(`  status=${status}`);
    if (!url.includes('/today-v2')) console.error(`  redirected to ${url}`);
    if (missing.length) console.error(`  missing lane headers: ${missing.join(', ')}`);
    if (consoleErrors.length) console.error(`  console errors: ${consoleErrors.length}`);
    if (pageErrors.length) console.error(`  page errors: ${pageErrors.length}`);
    process.exit(1);
  }
  console.log('\nSMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FATAL:', err);
  process.exit(2);
});
