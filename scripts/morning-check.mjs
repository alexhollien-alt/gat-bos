import { ensureAuthState, loadEnv } from './phase-9-auth-helper.mjs';
import { chromium } from 'playwright';

const STATE = '/tmp/morning-auth-state.json';
const { SITE } = loadEnv();
await ensureAuthState(STATE);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));

const t0 = Date.now();
const resp = await page.goto(`${SITE}/morning`, { waitUntil: 'domcontentloaded' });
const status = resp?.status();
const url = page.url();
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(800);

const h1 = await page.locator('h1').first().innerText().catch(() => '(no h1)');
const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 600);
const apiResp = await page.evaluate(async () => {
  const r = await fetch('/api/morning/latest', { credentials: 'include' });
  const ct = r.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await r.json() : await r.text();
  return { status: r.status, body: typeof body === 'string' ? body.slice(0, 200) : body };
});

await page.screenshot({ path: '/tmp/morning-render.png', fullPage: true });
await browser.close();

console.log(JSON.stringify({
  ms: Date.now() - t0,
  http_status: status,
  final_url: url,
  h1,
  body_preview: bodyText,
  api_morning_latest: {
    status: apiResp.status,
    body_keys: apiResp.body && typeof apiResp.body === 'object' ? Object.keys(apiResp.body) : null,
    brief_date: apiResp.body?.brief_date,
    model: apiResp.body?.model,
    contacts_scored: apiResp.body?.contacts_scored,
    brief_text_preview: typeof apiResp.body?.brief_text === 'string' ? apiResp.body.brief_text.slice(0, 240) : null,
    raw_preview: typeof apiResp.body === 'string' ? apiResp.body : null,
  },
  console_errors: errs,
}, null, 2));
