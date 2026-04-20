#!/usr/bin/env node
/**
 * Send Now enabled-state smoke + regression guard.
 *
 * Plan: ~/.claude/plans/send-now-enabled-smoke-2026-04-19.md
 * Parent: ~/.claude/plans/gat-bos-1.3.1-gmail-mvp.md UX Backlog [2026-04-18].
 *
 * Asserts that on a fresh draft with:
 *   - status = 'generated'
 *   - expires_at = NOW() + 30 min
 *   - revisions_count = 0
 *   - escalation_flag = null
 * the /drafts "Send Now" button is NOT disabled.
 *
 * Flow:
 *   1. Auth helper ensures alex session storage-state.
 *   2. Service-role seed one `emails` row + one `email_drafts` row.
 *   3. Navigate to /drafts, wait for list, click the seeded row by sentinel subject.
 *   4. Read Send Now button `disabled` attr; assert false.
 *   5. `finally`: soft-delete (email_drafts.status='discarded', emails.deleted_at=NOW()).
 *
 * Exit 0 = PASS. Non-zero = fail.
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { ensureAuthState, loadEnv } from './phase-9-auth-helper.mjs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const STATE = resolve(tmpdir(), 'send-now-enabled-smoke-auth.json');
const { URL, SERVICE, SITE } = loadEnv();
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const TAG = `send-now-smoke-${Date.now()}`;
const SENTINEL_SENDER = 'smoketest+sendnow@smoketest.local';
const DRAFT_SUBJECT = `Send Now enabled smoke probe ${TAG}`;
const DRAFT_BODY = 'Auto-generated smoke probe body. Safe to discard.';
const TARGET_URL = `${SITE}/drafts`;

let browser;
let emailId = null;
let draftId = null;
let assertionPassed = false;
let diagnostic = null;

async function softCleanup() {
  if (draftId) {
    const { error } = await admin
      .from('email_drafts')
      .update({ status: 'discarded', draft_subject: `[cleaned] ${DRAFT_SUBJECT}` })
      .eq('id', draftId);
    if (error) console.warn('[smoke] WARN: draft soft-delete failed:', error.message);
    else console.log(`[smoke] Draft ${draftId} soft-deleted (status=discarded)`);
  }
  if (emailId) {
    // Try to soft-delete the emails row if a deleted_at column exists.
    const { error } = await admin
      .from('emails')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', emailId);
    if (error) {
      // emails may not have a deleted_at column; rule 3 still satisfied via the draft row.
      console.warn('[smoke] NOTE: emails.deleted_at not settable (column may not exist):', error.message);
    } else {
      console.log(`[smoke] Emails row ${emailId} soft-deleted (deleted_at set)`);
    }
  }
}

try {
  console.log('[smoke] Ensuring alex session...');
  await ensureAuthState(STATE);

  console.log('[smoke] Seeding emails + email_drafts via service role...');
  const gmailId = `send-now-smoke-${TAG}`;
  const { data: emailRow, error: eErr } = await admin
    .from('emails')
    .insert({
      gmail_id: gmailId,
      from_email: SENTINEL_SENDER,
      from_name: 'Send Now Smoke Probe',
      subject: `Source: ${DRAFT_SUBJECT}`,
      body_plain: 'Source email for Send Now enabled smoke probe.',
      is_unread: true,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (eErr) throw new Error(`emails insert failed: ${eErr.message}`);
  emailId = emailRow.id;
  console.log(`[smoke] Seeded emails.id=${emailId}`);

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { data: draftRow, error: dErr } = await admin
    .from('email_drafts')
    .insert({
      email_id: emailId,
      draft_subject: DRAFT_SUBJECT,
      draft_body_plain: DRAFT_BODY,
      status: 'generated',
      expires_at: expiresAt,
      revisions_count: 0,
      escalation_flag: null,
    })
    .select('id, status, expires_at, revisions_count, escalation_flag')
    .single();
  if (dErr) throw new Error(`email_drafts insert failed: ${dErr.message}`);
  draftId = draftRow.id;
  console.log(`[smoke] Seeded email_drafts.id=${draftId} status=${draftRow.status} revisions=${draftRow.revisions_count} esc=${draftRow.escalation_flag ?? 'null'} expires=${draftRow.expires_at}`);

  console.log('[smoke] Launching browser with auth state...');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE });
  const page = await context.newPage();

  console.log(`[smoke] Navigating to ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

  // Wait for the Drafts page shell.
  await page.waitForSelector('h1:has-text("Drafts")', { timeout: 15000 });

  // Verify we are on /drafts (not bounced to login).
  if (new globalThis.URL(page.url()).pathname !== '/drafts') {
    throw new Error(`unexpected URL after navigation: ${page.url()}`);
  }

  // Wait for the list item whose subject contains our unique TAG to appear.
  // List items render `email.from_name || email.from_email` as title and
  // `email.subject` as the sub-line, so we match on the TAG inside the subject.
  const listItem = page.locator('aside button', { hasText: TAG }).first();
  await listItem.waitFor({ state: 'visible', timeout: 15000 });

  // Click our seeded draft to ensure it is the selected one.
  await listItem.click();

  // Wait for the Send Now button to render in the detail pane.
  const sendNow = page.locator('button:has-text("Send Now")').first();
  await sendNow.waitFor({ state: 'visible', timeout: 15000 });

  // Small settle so React has flushed any selection-change effects.
  await page.waitForTimeout(250);

  const isDisabled = await sendNow.isDisabled();
  console.log(`[smoke] Send Now button disabled = ${isDisabled}`);

  if (isDisabled !== false) {
    // Collect diagnostics before exiting.
    diagnostic = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const sendNowBtn = btns.find((b) => (b.textContent || '').trim().includes('Send Now'));
      const reviseBtn = btns.find((b) => (b.textContent || '').trim().startsWith('Revise'));
      const expiredBadge = Array.from(document.querySelectorAll('*')).some(
        (n) => (n.textContent || '').trim() === 'EXPIRED',
      );
      return {
        sendNowDisabledAttr: sendNowBtn?.getAttribute('disabled'),
        sendNowAria: sendNowBtn?.getAttribute('aria-disabled'),
        reviseLabel: reviseBtn?.textContent?.trim(),
        expiredBadgePresent: expiredBadge,
      };
    });
    console.error('[smoke] FAIL: Send Now was disabled. Diagnostic:', JSON.stringify(diagnostic, null, 2));
  } else {
    assertionPassed = true;
  }
} catch (err) {
  console.error('[smoke] EXCEPTION:', err?.message ?? err);
} finally {
  console.log('[smoke] Soft-cleanup...');
  await softCleanup();
  if (browser) await browser.close();
}

console.log('\n=== Send Now enabled-state smoke ===');
console.log(`Seeded emails.id: ${emailId ?? '(none)'}`);
console.log(`Seeded email_drafts.id: ${draftId ?? '(none)'}`);
console.log(`Assertion (Send Now disabled === false): ${assertionPassed ? 'PASS' : 'FAIL'}`);
if (diagnostic) console.log(`Diagnostic: ${JSON.stringify(diagnostic)}`);

process.exit(assertionPassed ? 0 : 1);
