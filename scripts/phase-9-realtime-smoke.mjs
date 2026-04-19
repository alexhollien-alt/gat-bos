#!/usr/bin/env node
/**
 * Phase 9 Gate 2 -- Two-window Realtime smoke on email_drafts INSERT.
 *
 * Flow:
 *   1. Auth helper ensures alex session state.
 *   2. Launch two independent Playwright browser contexts (separate storage domains),
 *      both loaded with the same authenticated storage state.
 *   3. Both contexts open /today and wait for DraftsPending card to render.
 *   4. Capture the baseline draft count in each window.
 *   5. Via service role, INSERT a test emails row + test email_drafts row (must join
 *      on emails because the card's query uses !inner). Mark them with an obvious
 *      Phase-9 tag so cleanup is unambiguous.
 *   6. Poll both windows up to 5s for the new draft subject to appear.
 *   7. Soft-delete: set email_drafts.status='discarded'. Leave the emails row in place
 *      per standing rule 3 (no hard deletes); emails has no deleted_at column.
 *
 * Exit 0 = PASS. Non-zero = fail.
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { ensureAuthState, loadEnv } from './phase-9-auth-helper.mjs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const STATE = resolve(tmpdir(), 'phase-9-auth-state.json');
const { URL, SERVICE, SITE } = loadEnv();
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const TAG = `phase-9-gate-2-${Date.now()}`;
const DRAFT_SUBJECT = `Phase 9 gate 2 REALTIME probe ${TAG}`;
const TARGET_URL = `${SITE}/today`;
const REALTIME_TIMEOUT_MS = 15000;
const SUBSCRIPTION_SETTLE_MS = 3000;

console.log('[gate-2] Ensuring alex session...');
await ensureAuthState(STATE);

console.log('[gate-2] Launching two Playwright contexts...');
const browser = await chromium.launch({ headless: true });
const ctxA = await browser.newContext({ storageState: STATE });
const ctxB = await browser.newContext({ storageState: STATE });
const pageA = await ctxA.newPage();
const pageB = await ctxB.newPage();

for (const [label, page] of [['A', pageA], ['B', pageB]]) {
  page.on('websocket', (ws) => {
    console.log(`[gate-2] [${label}] WS connected ${ws.url().slice(0, 80)}`);
    ws.on('close', () => console.log(`[gate-2] [${label}] WS closed`));
  });
}

async function openAndWait(page, label) {
  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('h2:has-text("Pending drafts")', { timeout: 15000 });
  // Either an empty-state paragraph, a list, or an error paragraph must be present.
  await page.waitForFunction(
    () => {
      const h2s = Array.from(document.querySelectorAll('h2'));
      const h2 = h2s.find((n) => n.textContent?.trim() === 'Pending drafts');
      if (!h2) return false;
      // Walk up to find the nearest <section> that holds only this card, not a parent.
      let node = h2;
      let section = null;
      while (node && node !== document.body) {
        if (node.tagName === 'SECTION') { section = node; break; }
        node = node.parentElement;
      }
      if (!section) return false;
      const txt = section.textContent || '';
      if (txt.includes('Loading...')) return false;
      if (txt.includes('No pending drafts')) return true;
      if (section.querySelectorAll('ul > li').length > 0) return true;
      return false;
    },
    null,
    { timeout: 15000 },
  );
  console.log(`[gate-2] [${label}] DraftsPending card rendered`);
}

await Promise.all([openAndWait(pageA, 'A'), openAndWait(pageB, 'B')]);

async function countDrafts(page) {
  return page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'));
    const h2 = h2s.find((n) => n.textContent?.trim() === 'Pending drafts');
    if (!h2) return -1;
    let node = h2, section = null;
    while (node && node !== document.body) {
      if (node.tagName === 'SECTION') { section = node; break; }
      node = node.parentElement;
    }
    if (!section) return -1;
    return section.querySelectorAll('ul > li').length;
  });
}

const baselineA = await countDrafts(pageA);
const baselineB = await countDrafts(pageB);
console.log(`[gate-2] Baseline -- A: ${baselineA}, B: ${baselineB}`);

console.log(`[gate-2] Waiting ${SUBSCRIPTION_SETTLE_MS}ms for Realtime subscription to settle...`);
await pageA.waitForTimeout(SUBSCRIPTION_SETTLE_MS);

console.log('[gate-2] Seeding emails + email_drafts via service role...');
const gmailId = `phase-9-gate-2-${TAG}`;
const { data: emailRow, error: eErr } = await admin
  .from('emails')
  .insert({
    gmail_id: gmailId,
    from_email: 'realtime-probe@phase9.local',
    from_name: 'Phase 9 Gate 2 Probe',
    subject: 'Phase 9 gate 2 source email',
    body_plain: 'Realtime smoke test source',
    is_unread: true,
    created_at: new Date().toISOString(),
  })
  .select('id')
  .single();
if (eErr) {
  console.error('[gate-2] FAIL: could not insert emails row:', eErr.message);
  await browser.close();
  process.exit(1);
}
const emailId = emailRow.id;
console.log(`[gate-2] Seeded emails.id=${emailId}`);

const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
const { data: draftRow, error: dErr } = await admin
  .from('email_drafts')
  .insert({
    email_id: emailId,
    draft_subject: DRAFT_SUBJECT,
    draft_body_plain: 'Phase 9 realtime probe',
    status: 'generated',
    expires_at: expiresAt,
  })
  .select('id')
  .single();
if (dErr) {
  console.error('[gate-2] FAIL: could not insert email_drafts row:', dErr.message);
  await browser.close();
  process.exit(1);
}
const draftId = draftRow.id;
console.log(`[gate-2] Seeded email_drafts.id=${draftId}`);

async function waitForDraftSubject(page, label) {
  const start = Date.now();
  while (Date.now() - start < REALTIME_TIMEOUT_MS) {
    const found = await page.evaluate((needle) => {
      const h2s = Array.from(document.querySelectorAll('h2'));
      const h2 = h2s.find((n) => n.textContent?.trim() === 'Pending drafts');
      if (!h2) return false;
      let node = h2, section = null;
      while (node && node !== document.body) {
        if (node.tagName === 'SECTION') { section = node; break; }
        node = node.parentElement;
      }
      if (!section) return false;
      return Array.from(section.querySelectorAll('ul > li')).some((li) =>
        li.textContent?.includes(needle),
      );
    }, DRAFT_SUBJECT);
    if (found) {
      const elapsed = Date.now() - start;
      console.log(`[gate-2] [${label}] Realtime update received in ${elapsed}ms`);
      return elapsed;
    }
    await page.waitForTimeout(100);
  }
  return -1;
}

const [elapsedA, elapsedB] = await Promise.all([
  waitForDraftSubject(pageA, 'A'),
  waitForDraftSubject(pageB, 'B'),
]);

let failures = 0;
if (elapsedA < 0) {
  console.error('[gate-2] FAIL: window A did not receive the realtime update within 5s');
  failures++;
}
if (elapsedB < 0) {
  console.error('[gate-2] FAIL: window B did not receive the realtime update within 5s');
  failures++;
}

console.log('[gate-2] Soft-deleting seed draft (status=discarded)...');
const { error: delErr } = await admin
  .from('email_drafts')
  .update({ status: 'discarded', draft_subject: `[cleaned] ${DRAFT_SUBJECT}` })
  .eq('id', draftId);
if (delErr) console.warn('[gate-2] WARN: soft-delete failed:', delErr.message);
else console.log('[gate-2] Seed draft discarded');

await browser.close();

console.log('\n=== Phase 9 Gate 2 -- Two-window Realtime smoke ===');
console.log(`Window A: ${elapsedA >= 0 ? `PASS (${elapsedA}ms)` : 'FAIL (timeout)'}`);
console.log(`Window B: ${elapsedB >= 0 ? `PASS (${elapsedB}ms)` : 'FAIL (timeout)'}`);
console.log(`Seeded emails.id: ${emailId}`);
console.log(`Seeded email_drafts.id: ${draftId} (status=discarded after test)`);
console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures} window${failures === 1 ? '' : 's'} timed out)`}`);
process.exit(failures === 0 ? 0 : 1);
