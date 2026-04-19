#!/usr/bin/env node
/**
 * Phase 9 Gate 3 -- Throttled-query independence.
 *
 * Verifies the four Today cards (DraftsPending, ProjectsActive, TouchpointsDue,
 * TodayEvents) each own independent useQuery instances so a slow/failing query
 * in one card cannot block the others. We use Playwright route interception to
 * artificially stall one Supabase table request and confirm the other three
 * still render within their normal budget.
 *
 * Flow:
 *   1. Authenticate, open /today.
 *   2. Route-intercept any GET to /rest/v1/email_drafts, delay it 8 seconds.
 *   3. Assert the drafts card is still in "Loading..." after 2s (slow query).
 *   4. Assert projects + touchpoints + events cards have all rendered
 *      content within the same 2s window (independent from drafts).
 *   5. Release the drafts response, assert drafts card renders.
 *
 * Exit 0 = PASS.
 */
import { chromium } from 'playwright';
import { ensureAuthState, loadEnv } from './phase-9-auth-helper.mjs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const STATE = resolve(tmpdir(), 'phase-9-auth-state.json');
const { SITE } = loadEnv();

const STALL_MS = 8000;
const OTHER_BUDGET_MS = 4000;

console.log('[gate-3] Ensuring alex session...');
await ensureAuthState(STATE);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: STATE });
const page = await ctx.newPage();

// Route: stall email_drafts REST GET for STALL_MS; pass everything else through.
await page.route('**/rest/v1/email_drafts*', async (route) => {
  if (route.request().method() !== 'GET') return route.continue();
  console.log(`[gate-3] Stalling email_drafts GET for ${STALL_MS}ms...`);
  await new Promise((r) => setTimeout(r, STALL_MS));
  console.log('[gate-3] Releasing stalled email_drafts GET');
  return route.continue();
});

const navStart = Date.now();
await page.goto(`${SITE}/today`, { waitUntil: 'domcontentloaded' });

// Helper: report each section's state.
async function sectionStates() {
  return page.evaluate(() => {
    const sections = {};
    for (const title of ['Pending drafts', 'Active projects', 'Touchpoints due', 'Calendar']) {
      const h2 = Array.from(document.querySelectorAll('h2')).find((n) =>
        (n.textContent || '').includes(title),
      );
      if (!h2) { sections[title] = 'missing'; continue; }
      let node = h2, section = null;
      while (node && node !== document.body) {
        if (node.tagName === 'SECTION') { section = node; break; }
        node = node.parentElement;
      }
      if (!section) { sections[title] = 'no-section'; continue; }
      const txt = section.textContent || '';
      if (txt.includes('Loading...')) sections[title] = 'loading';
      else if (section.querySelectorAll('ul > li').length > 0) sections[title] = 'has-rows';
      else sections[title] = 'empty-state';
    }
    return sections;
  });
}

// Give the OTHER queries time to resolve (but less than STALL_MS).
await page.waitForTimeout(OTHER_BUDGET_MS);
const snapshot1 = await sectionStates();
const elapsed1 = Date.now() - navStart;
console.log(`[gate-3] After ${elapsed1}ms:`, snapshot1);

// At this point: drafts should still be loading, others should have settled.
const otherCards = ['Active projects', 'Touchpoints due', 'Calendar'];
const othersSettled = otherCards.every(
  (name) => snapshot1[name] === 'has-rows' || snapshot1[name] === 'empty-state',
);
const draftsStillLoading = snapshot1['Pending drafts'] === 'loading';

let failures = [];
if (!othersSettled) {
  const unsettled = otherCards.filter(
    (n) => snapshot1[n] !== 'has-rows' && snapshot1[n] !== 'empty-state',
  );
  failures.push(
    `FAIL: other cards did not settle while drafts was stalled (unsettled: ${unsettled.join(', ')})`,
  );
}
if (!draftsStillLoading) {
  failures.push(
    `WARN: drafts was not in loading state at t=${elapsed1}ms (state=${snapshot1['Pending drafts']}). ` +
      `Route intercept may have missed the query. Retry or increase stall.`,
  );
}

// Wait for drafts to finally resolve.
await page.waitForTimeout(STALL_MS + 2000 - elapsed1);
const snapshot2 = await sectionStates();
const elapsed2 = Date.now() - navStart;
console.log(`[gate-3] After ${elapsed2}ms:`, snapshot2);
if (snapshot2['Pending drafts'] === 'loading') {
  failures.push('FAIL: drafts never resolved even after stall released');
}

await browser.close();

console.log('\n=== Phase 9 Gate 3 -- Throttled-query independence ===');
console.log(`Budget for independent cards: ${OTHER_BUDGET_MS}ms`);
console.log(`Stall applied to email_drafts GET: ${STALL_MS}ms`);
console.log(`Snapshot @ ${elapsed1}ms:`, snapshot1);
console.log(`Snapshot @ ${elapsed2}ms:`, snapshot2);
if (failures.length === 0) {
  console.log('\nPASS -- independent cards rendered while drafts was stalled.');
  process.exit(0);
} else {
  console.error('\nFAIL:');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
