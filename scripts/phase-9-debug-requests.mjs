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

page.on('console', (msg) => {
  const txt = msg.text();
  if (msg.type() === 'error' || txt.toLowerCase().includes('error')) console.log(`[console:${msg.type()}]`, txt);
});
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('request', (req) => {
  if (req.url().includes('supabase.co') || req.url().includes('/api/')) {
    console.log(`[req] ${req.method()} ${req.url().slice(0, 180)}`);
  }
});
page.on('response', (res) => {
  if (res.url().includes('supabase.co') || res.url().includes('/api/')) {
    console.log(`[res ${res.status()}] ${res.url().slice(0, 180)}`);
  }
});

await page.goto(`${SITE}/today`, { waitUntil: 'load' });
console.log('-- page loaded, waiting 6s for queries --');
await page.waitForTimeout(6000);

// Check the DraftsPending section state
const state = await page.evaluate(() => {
  const h2s = Array.from(document.querySelectorAll('h2'));
  const h2 = h2s.find((n) => n.textContent?.trim() === 'Pending drafts');
  if (!h2) return { error: 'no h2' };
  let node = h2, section = null;
  while (node && node !== document.body) {
    if (node.tagName === 'SECTION') { section = node; break; }
    node = node.parentElement;
  }
  return {
    text: section?.textContent?.slice(0, 200),
    liCount: section?.querySelectorAll('ul > li').length,
  };
});
console.log('section state:', state);

await browser.close();
