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
await page.goto(`${SITE}/today`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

const result = await page.evaluate(() => {
  const h2s = Array.from(document.querySelectorAll('h2'));
  const h2 = h2s.find((n) => n.textContent?.trim() === 'Pending drafts');
  if (!h2) return { error: 'no h2 found' };
  let node = h2, section = null;
  const ancestry = [];
  while (node && node !== document.body) {
    ancestry.push(`${node.tagName}#${node.id || ''}.${Array.from(node.classList).join('.')}`);
    if (node.tagName === 'SECTION' && !section) section = node;
    node = node.parentElement;
  }
  if (!section) return { error: 'no section ancestor', ancestry };
  const fullText = section.textContent;
  return {
    ancestry,
    textLen: fullText?.length,
    textSnippet: fullText?.slice(0, 500),
    hasLoading: fullText?.includes('Loading...'),
    hasEmpty: fullText?.includes('No pending drafts'),
    liCount: section.querySelectorAll('ul > li').length,
  };
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
