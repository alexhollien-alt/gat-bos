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
  const t = msg.type();
  if (['error', 'warning', 'log', 'info'].includes(t)) {
    console.log(`[${t}]`, msg.text().slice(0, 400));
  }
});
page.on('pageerror', (err) => console.log('[PAGEERROR]', err.stack?.slice(0, 600) || err.message));

await page.goto(`${SITE}/today`, { waitUntil: 'load' });
await page.waitForTimeout(5000);

// Check whether React has hydrated by calling a React-managed event
const hydrationClue = await page.evaluate(() => {
  const btn = document.querySelector('button[aria-label="Refresh today view"]');
  if (!btn) return { hasRefresh: false };
  // Look for React fiber node
  const key = Object.keys(btn).find((k) => k.startsWith('__reactFiber$'));
  const propKey = Object.keys(btn).find((k) => k.startsWith('__reactProps$'));
  return {
    hasRefresh: true,
    hasReactFiber: !!key,
    hasReactProps: !!propKey,
    propsHasClick: propKey ? typeof btn[propKey].onClick : 'no-props-key',
  };
});
console.log('Hydration clue:', hydrationClue);
await browser.close();
