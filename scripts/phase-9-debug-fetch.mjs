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

let total = 0;
page.on('request', (req) => {
  total++;
  if (total <= 10) console.log(`[req ${total}]`, req.method(), req.url().slice(0, 120));
});

await page.goto(`${SITE}/today`, { waitUntil: 'load' });
console.log(`\nTotal requests captured during /today nav: ${total}`);

// Issue a manual fetch from the page to ensure listener works
await page.evaluate(async () => {
  try {
    const r = await fetch('/api/auth/gmail/callback');
    return { ok: r.ok, status: r.status };
  } catch (e) { return { error: e.message }; }
});
console.log(`Total requests after manual fetch: ${total}`);

await page.waitForTimeout(2000);
console.log(`Total after wait: ${total}`);

await browser.close();
