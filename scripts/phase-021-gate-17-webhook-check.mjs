#!/usr/bin/env node
/**
 * Phase 021 -- Slice 8 Phase 5 Gate 17 verification.
 *
 * Goal: confirm the Resend webhook landed an `email.delivered` (or sibling)
 * activity_events row tied to the most recent dry-run send to
 * alex@alexhollienco.com, OR identify the gap (route not reached, secret
 * mismatch, verb mapping not yet wired).
 *
 * Reads ~/crm/.env.local for SUPABASE creds. Service-role only.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const envPath = resolve(homedir(), 'crm', '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

function log(label, payload) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(payload, null, 2));
}

// 1. Most recent messages_log row to alex@alexhollienco.com.
//    Schema: id, template_id, recipient_email, send_mode, provider_message_id,
//    status, event_sequence (jsonb), sent_at, created_at, deleted_at, user_id.
const { data: msgRows, error: msgErr } = await admin
  .from('messages_log')
  .select('id, created_at, sent_at, recipient_email, send_mode, provider_message_id, status, event_sequence, template_id')
  .eq('recipient_email', 'alex@alexhollienco.com')
  .order('created_at', { ascending: false })
  .limit(5);

if (msgErr) {
  log('messages_log query ERROR', msgErr);
  process.exit(1);
}
log('messages_log latest 5 (alex@alexhollienco.com)', (msgRows ?? []).map((r) => ({
  id: r.id,
  created_at: r.created_at,
  sent_at: r.sent_at,
  status: r.status,
  send_mode: r.send_mode,
  provider_message_id: r.provider_message_id,
  template_id: r.template_id,
  event_sequence_count: Array.isArray(r.event_sequence) ? r.event_sequence.length : null,
  event_sequence_verbs: Array.isArray(r.event_sequence) ? r.event_sequence.map((e) => e.event ?? e.type ?? e.verb ?? Object.keys(e)[0]) : null,
})));

const latest = msgRows?.[0];
if (!latest) {
  log('Gate 17 BLOCKED', { reason: 'No messages_log row found for alex@alexhollienco.com' });
  process.exit(1);
}

// 2. activity_events rows touching email/resend/webhook in the last 2 hours.
const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const { data: evtRows, error: evtErr } = await admin
  .from('activity_events')
  .select('id, occurred_at, verb, object_table, object_id, context, deleted_at')
  .gte('occurred_at', since)
  .order('occurred_at', { ascending: false })
  .limit(50);

if (evtErr) {
  log('activity_events query ERROR', evtErr);
  process.exit(1);
}
const verbs = (evtRows ?? []).reduce((acc, r) => {
  acc[r.verb] = (acc[r.verb] ?? 0) + 1;
  return acc;
}, {});
log('activity_events verb tally (last 2h)', verbs);

const emailVerbs = (evtRows ?? []).filter((r) => /email|resend|delivered|bounce|opened|clicked|webhook/i.test(r.verb));
log('activity_events email-related rows (last 2h)', emailVerbs.map((r) => ({
  id: r.id,
  occurred_at: r.occurred_at,
  verb: r.verb,
  object_table: r.object_table,
  object_id: r.object_id,
  context: r.context,
})));

const tiedToLatest = emailVerbs.filter((r) => {
  if (r.object_table === 'messages_log' && r.object_id === latest.id) return true;
  const ctx = r.context ?? {};
  const ctxStr = JSON.stringify(ctx);
  return ctxStr.includes(latest.id) || (latest.provider_message_id && ctxStr.includes(latest.provider_message_id));
});
log('activity_events rows tied to latest messages_log row', {
  latest_message_id: latest.id,
  latest_provider_message_id: latest.provider_message_id,
  matches: tiedToLatest.length,
  rows: tiedToLatest,
});

// 3. Quick check: any activity_events row that name-references resend at all in last 24h.
const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { data: resendRows, error: resendErr } = await admin
  .from('activity_events')
  .select('id, occurred_at, verb, object_table, object_id, context')
  .or('verb.ilike.%email%,verb.ilike.%resend%,verb.ilike.%message%,verb.ilike.%delivered%,object_table.eq.messages_log')
  .gte('occurred_at', since24)
  .order('occurred_at', { ascending: false })
  .limit(20);

if (resendErr) {
  log('resend-scoped activity_events ERROR', resendErr);
} else {
  log('activity_events email/resend rows (last 24h)', (resendRows ?? []).map((r) => ({
    id: r.id,
    occurred_at: r.occurred_at,
    verb: r.verb,
    object_table: r.object_table,
    object_id: r.object_id,
    ctx_keys: r.context ? Object.keys(r.context) : null,
  })));
}

// 3.5 message_events lookup -- this is the actual webhook write target per
//     src/app/api/webhooks/resend/route.ts (writes message_events, not
//     activity_events). activity_events only sees interaction.email rows
//     for opened/clicked, never delivered.
const sentEvent = Array.isArray(latest.event_sequence)
  ? latest.event_sequence.find((e) => e?.event === 'sent')
  : null;
const fallbackResendId = sentEvent?.payload?.fallback_message_id ?? null;
log('latest send_mode + provider IDs in event_sequence', {
  send_mode: latest.send_mode,
  primary_provider_message_id: latest.provider_message_id,
  resend_fallback_message_id_in_event_sequence: fallbackResendId,
  note: latest.send_mode === 'both'
    ? 'send_mode=both: primary=Gmail, fallback=Resend. messages_log.provider_message_id stores the Gmail ID. Resend ID lives in event_sequence[].sent.payload.fallback_message_id.'
    : null,
});

const { data: msgEvtRows, error: msgEvtErr } = await admin
  .from('message_events')
  .select('id, received_at, event_type, provider_message_id, payload')
  .eq('message_log_id', latest.id)
  .is('deleted_at', null)
  .order('received_at', { ascending: false });
if (msgEvtErr) {
  log('message_events query ERROR', msgEvtErr);
} else {
  log('message_events for latest messages_log row', {
    message_log_id: latest.id,
    rows: (msgEvtRows ?? []).map((r) => ({
      id: r.id,
      received_at: r.received_at,
      event_type: r.event_type,
      provider_message_id: r.provider_message_id,
    })),
  });
}

// Also: any message_events in last 24h whose provider_message_id matches
// the Resend fallback ID, in case status-sync trigger hadn't joined them
// to messages_log yet (would only happen if there's no messages_log row
// with that provider_message_id, e.g. the 'both' wiring gap).
if (fallbackResendId) {
  const { data: byResendId } = await admin
    .from('message_events')
    .select('id, received_at, event_type, message_log_id')
    .eq('provider_message_id', fallbackResendId)
    .order('received_at', { ascending: false });
  log('message_events keyed by resend fallback ID', {
    resend_id: fallbackResendId,
    rows: byResendId ?? [],
  });
}

// 4. Verdict.
// Verdict factors in BOTH activity_events ties AND message_events presence.
const msgEvtCount = (msgEvtRows ?? []).length;
const passActivity = tiedToLatest.length > 0;
const passMsgEvents = msgEvtCount > 0;

if (passActivity || passMsgEvents) {
  log('Gate 17 RESULT', {
    status: 'PASS',
    activity_events_ties: tiedToLatest.length,
    message_events_count: msgEvtCount,
    note: 'Webhook reached the system. message_events is the canonical landing table; activity_events ties are bonus (only opened/clicked emit interaction.email).',
  });
  process.exit(0);
} else {
  log('Gate 17 RESULT', {
    status: 'NO MATCH',
    note: 'Neither activity_events nor message_events shows a webhook landing for the latest send.',
    diagnose: [
      '1. Resend dashboard -- has the webhook fired? Check Webhooks log for the most recent send.',
      '2. send_mode=both wiring gap -- messages_log.provider_message_id stores Gmail ID, not Resend. Webhook lookup at src/app/api/webhooks/resend/route.ts:147-152 will MISS unless the row stores the Resend ID. Resend ID lives in event_sequence[].sent.payload.fallback_message_id; webhook does not look there.',
      '3. RESEND_WEBHOOK_SECRET parity -- mismatched secret -> 401 -> Resend retries 3x then drops. Compare vercel env vs Resend dashboard endpoint config.',
      '4. Vercel function logs for /api/webhooks/resend on the most recent prod deploy -- a 401 vs 500 vs no-call distinguishes secret mismatch from never-called.',
    ],
  });
  process.exit(1);
}
