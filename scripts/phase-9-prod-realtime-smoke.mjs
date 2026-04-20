#!/usr/bin/env node
/**
 * Phase 9 PROD Gate 2 -- Two-window Realtime smoke on email_drafts INSERT
 * against https://gat-bos.vercel.app.
 *
 * Fork of phase-9-realtime-smoke.mjs:
 *   - Uses phase-9-prod-auth-helper (SITE pinned to prod URL).
 *   - Separate state cache file.
 *   - Same Supabase project (URL/SERVICE/ANON), so seed flow is unchanged.
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { ensureAuthState, loadEnv } from './phase-9-prod-auth-helper.mjs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const STATE = resolve(tmpdir(), 'phase-9-prod-auth-state.json');
const { URL, SERVICE, SITE } = loadEnv();
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const TAG = `phase-9-prod-gate-2-${Date.now()}`;
const DRAFT_SUBJECT = `Phase 9 PROD gate 2 REALTIME probe ${TAG}`;
const TARGET_URL = `${SITE}/today`;
const REALTIME_TIMEOUT_MS = 15000;
const SUBSCRIPTION_SETTLE_MS = 3000;

console.log('[gate-2-prod] Ensuring alex session...');
await ensureAuthState(STATE);

console.log('[gate-2-prod] Launching two Playwright contexts...');
const browser = await chromium.launch({ headless: true });
const ctxA = await browser.newContext({ storageState: STATE });
const ctxB = await browser.newContext({ storageState: STATE });
const pageA = await ctxA.newPage();
const pageB = await ctxB.newPage();

for (const [label, page] of [['A', pageA], ['B', pageB]]) {
  page.on('websocket', (ws) => {
    console.log(`[gate-2-prod] [${label}] WS connected ${ws.url().slice(0, 80)}`);
    ws.on('close', () => console.log(`[gate-2-prod] [${label}] WS closed`));
  });
}

async function openAndWait(page, label) {
  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('h2:has-text("Pending drafts")', { timeout: 20000 });
  await page.waitForFunction(
    () => {
      const h2s = Array.from(document.querySelectorAll('h2'));
      const h2 = h2s.find((n) => n.textContent?.trim() === 'Pending drafts');
      if (!h2) return false;
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
    { timeout: 20000 },
  );
  console.log(`[gate-2-prod] [${label}] DraftsPending card rendered`);
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
console.log(`[gate-2-prod] Baseline -- A: ${baselineA}, B: ${baselineB}`);

console.log(`[gate-2-prod] Waiting ${SUBSCRIPTION_SETTLE_MS}ms for Realtime subscription to settle...`);
await pageA.waitForTimeout(SUBSCRIPTION_SETTLE_MS);

console.log('[gate-2-prod] Seeding emails + email_drafts via service role...');
const gmailId = `phase-9-prod-gate-2-${TAG}`;
const { data: emailRow, error: eErr } = await admin
  .from('emails')
  .insert({
    gmail_id: gmailId,
    from_email: 'realtime-probe@phase9-prod.local',
    from_name: 'Phase 9 PROD Gate 2 Probe',
    subject: 'Phase 9 PROD gate 2 source email',
    body_plain: 'Realtime smoke test source',
    is_unread: true,
    created_at: new Date().toISOString(),
  })
  .select('id')
  .single();
if (eErr) {
  console.error('[gate-2-prod] FAIL: could not insert emails row:', eErr.message);
  await browser.close();
  process.exit(1);
}
const emailId = emailRow.id;
console.log(`[gate-2-prod] Seeded emails.id=${emailId}`);

const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
const { data: draftRow, error: dErr } = await admin
  .from('email_drafts')
  .insert({
    email_id: emailId,
    draft_subject: DRAFT_SUBJECT,
    draft_body_plain: 'Phase 9 prod realtime probe',
    status: 'generated',
    expires_at: expiresAt,
  })
  .select('id')
  .single();
if (dErr) {
  console.error('[gate-2-prod] FAIL: could not insert email_drafts row:', dErr.message);
  await browser.close();
  process.exit(1);
}
const draftId = draftRow.id;
console.log(`[gate-2-prod] Seeded email_drafts.id=${draftId}`);

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
      console.log(`[gate-2-prod] [${label}] Realtime update received in ${elapsed}ms`);
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
  console.error('[gate-2-prod] FAIL: window A did not receive the realtime update within timeout');
  failures++;
}
if (elapsedB < 0) {
  console.error('[gate-2-prod] FAIL: window B did not receive the realtime update within timeout');
  failures++;
}

console.log('[gate-2-prod] Soft-deleting seed draft (status=discarded)...');
const { error: delErr } = await admin
  .from('email_drafts')
  .update({ status: 'discarded', draft_subject: `[cleaned] ${DRAFT_SUBJECT}` })
  .eq('id', draftId);
if (delErr) console.warn('[gate-2-prod] WARN: soft-delete failed:', delErr.message);
else console.log('[gate-2-prod] Seed draft discarded');

await browser.close();

console.log('\n=== Phase 9 PROD Gate 2 -- Two-window Realtime smoke ===');
console.log(`Window A: ${elapsedA >= 0 ? `PASS (${elapsedA}ms)` : 'FAIL (timeout)'}`);
console.log(`Window B: ${elapsedB >= 0 ? `PASS (${elapsedB}ms)` : 'FAIL (timeout)'}`);
console.log(`Seeded emails.id: ${emailId}`);
console.log(`Seeded email_drafts.id: ${draftId} (status=discarded after test)`);
console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures} window${failures === 1 ? '' : 's'} timed out)`}`);
process.exit(failures === 0 ? 0 : 1);
