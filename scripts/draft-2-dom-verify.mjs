// DOM-level verification of Draft 2 (bypasses Next.js dev-server CSS cache flakiness).
// Reads computed styles + DOM structure to confirm capture bar wiring.
import { chromium } from 'playwright';
import { ensureAuthState, loadEnv } from './phase-9-auth-helper.mjs';

const STATE = '/tmp/capture-bar-auth-state.json';

async function main() {
  const { SITE } = loadEnv();
  await ensureAuthState(STATE);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on('console', (msg) => console.log('[browser console]', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('[browser pageerror]', err.message));

  await page.goto(`${SITE}/today`, { waitUntil: 'load' });
  await page.waitForSelector('input[aria-label="Universal capture"]', { state: 'visible', timeout: 30000 });
  // Give React hydration ample time.
  await page.waitForTimeout(3000);

  const result = await page.evaluate(() => {
    const input = document.querySelector('input[aria-label="Universal capture"]');
    const form = input?.closest('form');
    const wrapper = form?.parentElement?.parentElement;
    const preview = form?.parentElement?.querySelector('[aria-live="polite"]');
    const submit = form?.querySelector('button[aria-label="Submit capture"]');
    const sparkles = form?.querySelector('svg.lucide-sparkles');
    return {
      hasInput: !!input,
      hasForm: !!form,
      hasSparkles: !!sparkles,
      hasSubmit: !!submit,
      hasPreviewSlot: !!preview,
      formClasses: form?.className ?? null,
      wrapperClasses: wrapper?.className ?? null,
      inputPlaceholder: input?.getAttribute('placeholder'),
      previewInitial: preview?.textContent?.trim() ?? '',
      formPosition: form ? getComputedStyle(form).position : null,
      wrapperPosition: wrapper ? getComputedStyle(wrapper).position : null,
      wrapperBottom: wrapper ? getComputedStyle(wrapper).bottom : null,
      formBackdrop: form ? getComputedStyle(form).backdropFilter : null,
      formBg: form ? getComputedStyle(form).backgroundColor : null,
      sidebarVisible: !!document.querySelector('aside, [class*="sidebar"]'),
    };
  });

  // Type to test live preview. Use pressSequentially so React onChange fires naturally.
  const input = page.locator('input[aria-label="Universal capture"]');
  await input.click();
  await input.pressSequentially('Met with Julie Jarmiolowski at Optima', { delay: 20 });
  await page.waitForTimeout(800);
  const snap1 = await page.evaluate(() => {
    const inp = document.querySelector('input[aria-label="Universal capture"]');
    const form = inp?.closest('form');
    const el = form?.parentElement?.querySelector('[aria-live="polite"]');
    return { inputValue: inp?.value ?? null, previewText: el?.textContent ?? null };
  });

  await page.keyboard.press('Meta+A');
  await page.keyboard.press('Backspace');
  await input.pressSequentially('flyer for Denise', { delay: 20 });
  await page.waitForTimeout(800);
  const snap2 = await page.evaluate(() => {
    const inp = document.querySelector('input[aria-label="Universal capture"]');
    const form = inp?.closest('form');
    const el = form?.parentElement?.querySelector('[aria-live="polite"]');
    return { inputValue: inp?.value ?? null, previewText: el?.textContent ?? null };
  });

  console.log(JSON.stringify({ ...result, snap1, snap2 }, null, 2));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
