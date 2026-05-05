#!/usr/bin/env node
/**
 * Phase 3.3 -- EventInvite send triage (autonomous mode).
 *
 * Reusable triage for any EventInvite send window. Given an EVENT_ID, pulls:
 *   1. message_events count by event_type for all message_log_ids tied to the event
 *   2. error_logs count for /api/webhooks/resend since the event's send timestamp
 *      (uses error_logs.created_at, not occurred_at)
 *   3. Resend API GET /emails/:id status for each resend_message_id
 *      (resolves Resend ID from messages_log.provider_message_id when send_mode='resend',
 *       or event_sequence[].sent.payload.fallback_message_id when send_mode='both')
 *   4. 3-state verdict: "not invoked" / "invoked-failing" / "live-proceed"
 *
 * Autonomous-mode capabilities (added 2026-05-04):
 *   --watch                : Poll every 30s up to 10min, exit on state change
 *   --interval=<seconds>   : Override poll interval (default 30)
 *   --timeout=<seconds>    : Override watch timeout (default 600)
 *   --self-heal            : Diagnose-and-report mode. Verify Resend webhook config
 *                            via Resend API, pull Vercel function logs on
 *                            "not invoked", surface specific defect. NEVER mutates
 *                            third-party dashboard config; reports + exits.
 *   --append-plan          : Append results block to the active plan file
 *
 * Usage:
 *   cd ~/crm && node scripts/phase-033-event-invite-triage.mjs <EVENT_ID> [flags]
 *
 * Reads ~/crm/.env.local for credentials. Service-role only. Optional env:
 *   RESEND_READ_API_KEY    : Defaults to RESEND_API_KEY; separate read scope
 *                            unavailable at this Resend tier (Full Access vs
 *                            Sending Access only). Set both to the same key.
 *   VERCEL_TOKEN           : For function-log pulls on 'not invoked' verdict
 *   VERCEL_PROJECT_ID      : Vercel project id (or auto-detected from .vercel/project.json)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// argv + env
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const EVENT_ID = argv.find((a) => /^[0-9a-f-]{36}$/i.test(a));
if (!EVENT_ID) {
  console.error('Usage: node scripts/phase-033-event-invite-triage.mjs <EVENT_ID> [--watch] [--self-heal] [--append-plan]');
  process.exit(2);
}
const WATCH = argv.includes('--watch');
const SELF_HEAL = argv.includes('--self-heal');
const APPEND_PLAN = argv.includes('--append-plan');
const INTERVAL_S = Number((argv.find((a) => a.startsWith('--interval=')) ?? '--interval=30').split('=')[1]);
const TIMEOUT_S = Number((argv.find((a) => a.startsWith('--timeout=')) ?? '--timeout=600').split('=')[1]);

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
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = env.RESEND_API_KEY;
const RESEND_READ_KEY = env.RESEND_READ_API_KEY ?? env.RESEND_API_KEY;
const RESEND_WEBHOOK_SECRET = env.RESEND_WEBHOOK_SECRET;
const VERCEL_TOKEN = env.VERCEL_TOKEN ?? process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = env.VERCEL_PROJECT_ID ?? process.env.VERCEL_PROJECT_ID;
const PLAN_PATH = resolve(homedir(), '.claude/plans/plan-3-sentence-summary-binary-lemon.md');

if (!URL_SB || !SERVICE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ~/crm/.env.local');
  process.exit(2);
}

const admin = createClient(URL_SB, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const section = (label) => console.log(`\n=== ${label} ===`);

// ---------------------------------------------------------------------------
// PREFLIGHT: information_schema column existence check
// ---------------------------------------------------------------------------
async function preflightSchema() {
  section('Preflight: schema drift check');
  const expected = {
    events: ['id', 'title', 'start_at', 'end_at', 'slots_remaining', 'slots_total', 'deleted_at'],
    event_invites: ['id', 'event_id', 'status', 'sent_at', 'message_log_id', 'contact_id', 'deleted_at'],
    messages_log: ['id', 'recipient_email', 'send_mode', 'status', 'sent_at', 'provider_message_id', 'event_sequence', 'deleted_at'],
    message_events: ['id', 'event_type', 'message_log_id', 'received_at', 'deleted_at'],
    error_logs: ['id', 'endpoint', 'error_code', 'error_message', 'context', 'created_at'],
  };
  const failures = [];
  for (const [tbl, cols] of Object.entries(expected)) {
    // Attempt a 0-row select that names every column. If a column is missing,
    // PostgREST returns 42703 with the offending column name.
    const { error } = await admin.from(tbl).select(cols.join(',')).limit(0);
    if (error) {
      failures.push({ table: tbl, error: error.message, code: error.code });
    } else {
      console.log(`  ${tbl}: OK (${cols.length} columns)`);
    }
  }
  if (failures.length) {
    console.error('SCHEMA DRIFT DETECTED:');
    for (const f of failures) console.error(`  ${f.table}: [${f.code}] ${f.error}`);
    process.exit(3);
  }
  console.log('Schema preflight: PASS');
}

// ---------------------------------------------------------------------------
// Self-heal: Resend webhook config verify (read-only, never mutates)
// ---------------------------------------------------------------------------
async function resendWebhookSelfVerify() {
  section('Self-heal: Resend webhook config (read-only)');
  if (!RESEND_KEY) {
    console.log('  RESEND_API_KEY missing; skipping');
    return { healthy: false, reason: 'no_api_key' };
  }
  const expectedUrl = 'https://gat-bos.vercel.app/api/webhooks/resend';
  let res;
  try {
    res = await fetch('https://api.resend.com/webhooks', {
      headers: { Authorization: `Bearer ${RESEND_KEY}` },
    });
  } catch (e) {
    console.log(`  fetch error: ${e?.message ?? e}`);
    return { healthy: false, reason: 'fetch_error' };
  }
  if (!res.ok) {
    const body = await res.text();
    const truncated = body.slice(0, 200);
    console.log(`  GET /webhooks -> HTTP ${res.status}: ${truncated}`);
    if (res.status === 401 && /restricted/i.test(body)) {
      console.log('  NOTE: current API key lacks webhook scope. Cannot self-verify dashboard config.');
      console.log('  PROPOSED FIX (manual, requires Alex): create a full-access Resend API key OR a webhook-scoped key.');
      return { healthy: false, reason: 'api_key_scope', api_response: truncated };
    }
    return { healthy: false, reason: `http_${res.status}`, api_response: truncated };
  }
  const body = await res.json();
  const hooks = body.data ?? body;
  const matching = (hooks ?? []).filter((h) =>
    typeof h.endpoint === 'string' && h.endpoint.includes('/api/webhooks/resend')
  );
  console.log(`  total webhooks: ${(hooks ?? []).length}`);
  console.log(`  matching /api/webhooks/resend: ${matching.length}`);
  if (matching.length === 0) {
    console.log(`  PROPOSED FIX (manual): no webhook endpoint configured pointing at /api/webhooks/resend.`);
    console.log(`  Resend dashboard -> Webhooks -> Add endpoint -> ${expectedUrl}`);
    return { healthy: false, reason: 'no_endpoint' };
  }
  for (const h of matching) {
    const enabled = h.disabled === false || h.status === 'enabled' || h.enabled === true;
    const urlMatch = h.endpoint === expectedUrl;
    console.log(`  hook id=${h.id} url=${h.endpoint} enabled=${enabled} url_match=${urlMatch}`);
    if (h.signing_secret_fingerprint || h.fingerprint) {
      const fp = h.signing_secret_fingerprint ?? h.fingerprint;
      const localFp = RESEND_WEBHOOK_SECRET
        ? createHash('sha256').update(RESEND_WEBHOOK_SECRET).digest('hex').slice(0, 16)
        : null;
      console.log(`  signing_secret_fingerprint(remote)=${fp}  localShortHash=${localFp ?? '(no env)'}`);
    }
  }
  const healthy = matching.some(
    (h) => h.endpoint === expectedUrl && (h.disabled === false || h.status === 'enabled' || h.enabled === true)
  );
  if (!healthy) {
    console.log(`  PROPOSED FIX (manual): no enabled endpoint with exact URL ${expectedUrl}.`);
  } else {
    console.log(`  Webhook endpoint config: HEALTHY`);
  }
  return { healthy, reason: healthy ? 'ok' : 'not_enabled_or_url_mismatch', matching };
}

// ---------------------------------------------------------------------------
// Self-heal: Vercel function logs for /api/webhooks/resend (last hour)
// ---------------------------------------------------------------------------
async function vercelFunctionLogs(sinceIso) {
  section('Self-heal: Vercel function logs for /api/webhooks/resend');
  if (!VERCEL_TOKEN) {
    console.log('  VERCEL_TOKEN missing; skipping. Add to ~/crm/.env.local to enable.');
    return { fetched: false, reason: 'no_token' };
  }
  let projectId = VERCEL_PROJECT_ID;
  if (!projectId) {
    const linkPath = resolve(homedir(), 'crm', '.vercel', 'project.json');
    if (existsSync(linkPath)) {
      try {
        const link = JSON.parse(readFileSync(linkPath, 'utf8'));
        projectId = link.projectId;
      } catch {
        // fall through
      }
    }
  }
  if (!projectId) {
    console.log('  Vercel project ID not resolvable. Set VERCEL_PROJECT_ID or run `vercel link`.');
    return { fetched: false, reason: 'no_project_id' };
  }
  // List recent prod deployments, take the latest READY one.
  const depsUrl = `https://api.vercel.com/v6/deployments?projectId=${projectId}&target=production&state=READY&limit=1`;
  let dep;
  try {
    const r = await fetch(depsUrl, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } });
    if (!r.ok) {
      console.log(`  GET /v6/deployments -> HTTP ${r.status}`);
      return { fetched: false, reason: `http_${r.status}` };
    }
    const body = await r.json();
    dep = body.deployments?.[0];
  } catch (e) {
    console.log(`  fetch error: ${e?.message ?? e}`);
    return { fetched: false, reason: 'fetch_error' };
  }
  if (!dep) {
    console.log('  No READY production deployments found.');
    return { fetched: false, reason: 'no_deployments' };
  }
  console.log(`  latest prod deployment: ${dep.uid} url=${dep.url}`);
  // Pull events for this deployment, filter for our function path.
  const since = Date.parse(sinceIso);
  const eventsUrl = `https://api.vercel.com/v3/deployments/${dep.uid}/events?since=${since}&limit=200`;
  let evts;
  try {
    const r = await fetch(eventsUrl, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } });
    if (!r.ok) {
      console.log(`  GET /v3/deployments/:id/events -> HTTP ${r.status}`);
      return { fetched: false, reason: `events_http_${r.status}` };
    }
    evts = await r.json();
  } catch (e) {
    console.log(`  events fetch error: ${e?.message ?? e}`);
    return { fetched: false, reason: 'events_fetch_error' };
  }
  const arr = Array.isArray(evts) ? evts : evts.events ?? [];
  const webhookHits = arr.filter((e) => {
    const text = JSON.stringify(e);
    return /\/api\/webhooks\/resend/.test(text);
  });
  console.log(`  total events fetched: ${arr.length}`);
  console.log(`  hits for /api/webhooks/resend: ${webhookHits.length}`);
  if (webhookHits.length === 0) {
    console.log('  CLASSIFICATION: zero invocations -> Resend dashboard config is wrong (URL/disabled/secret).');
    return { fetched: true, hits: 0, classification: 'zero_invocations' };
  }
  const statuses = webhookHits.map((e) => e.statusCode ?? e.payload?.statusCode).filter(Boolean);
  const has5xx = statuses.some((s) => s >= 500);
  const has4xx = statuses.some((s) => s >= 400 && s < 500);
  let classification;
  if (has5xx) classification = 'handler_5xx';
  else if (has4xx) classification = 'handler_4xx_or_edge_routing';
  else classification = 'invocations_succeeded_silently';
  console.log(`  status codes seen: ${[...new Set(statuses)].join(',') || 'none'}`);
  console.log(`  CLASSIFICATION: ${classification}`);
  for (const e of webhookHits.slice(0, 5)) {
    console.log(`    ${e.created ?? e.timestamp ?? ''}  type=${e.type}  status=${e.statusCode ?? e.payload?.statusCode}  text=${(e.text ?? e.payload?.text ?? '').slice(0, 120)}`);
  }
  return { fetched: true, hits: webhookHits.length, classification, statuses };
}

// ---------------------------------------------------------------------------
// CORE: single triage pass returning the verdict + counts
// ---------------------------------------------------------------------------
async function runTriagePass(eventId) {
  // 1. event row
  const { data: eventRow, error: eventErr } = await admin
    .from('events')
    .select('id, title, start_at, end_at, slots_remaining, slots_total')
    .eq('id', eventId)
    .is('deleted_at', null)
    .maybeSingle();
  if (eventErr) throw new Error(`events: ${eventErr.message}`);
  if (!eventRow) throw new Error(`No event found for id=${eventId}`);

  // 2. invites
  const { data: invites, error: invErr } = await admin
    .from('event_invites')
    .select('id, status, sent_at, message_log_id, contact_id')
    .eq('event_id', eventId)
    .is('deleted_at', null);
  if (invErr) throw new Error(`event_invites: ${invErr.message}`);
  const messageLogIds = invites.map((i) => i.message_log_id).filter(Boolean);
  if (messageLogIds.length === 0) throw new Error('no message_log_ids on event_invites');

  // 3. messages_log
  const { data: msgLogs, error: msgLogErr } = await admin
    .from('messages_log')
    .select('id, recipient_email, send_mode, status, sent_at, provider_message_id, event_sequence')
    .in('id', messageLogIds)
    .is('deleted_at', null);
  if (msgLogErr) throw new Error(`messages_log: ${msgLogErr.message}`);
  const earliestSentAt = msgLogs.map((r) => r.sent_at).filter(Boolean).sort()[0] ?? null;
  const latestSentAt = msgLogs.map((r) => r.sent_at).filter(Boolean).sort().slice(-1)[0] ?? null;
  const sendModeTally = msgLogs.reduce((a, r) => ((a[r.send_mode] = (a[r.send_mode] ?? 0) + 1), a), {});

  const resolveResendId = (row) => {
    if (row.send_mode === 'resend') return row.provider_message_id ?? null;
    if (row.send_mode === 'both' && Array.isArray(row.event_sequence)) {
      const sentEvent = row.event_sequence.find((e) => e?.event === 'sent');
      return sentEvent?.payload?.fallback_message_id ?? null;
    }
    return null;
  };
  const resendIds = msgLogs.map(resolveResendId).filter(Boolean);

  // 4. message_events
  const { data: msgEvents, error: msgEvtErr } = await admin
    .from('message_events')
    .select('id, event_type, message_log_id, received_at')
    .in('message_log_id', messageLogIds)
    .is('deleted_at', null);
  if (msgEvtErr) throw new Error(`message_events: ${msgEvtErr.message}`);
  const msgEventTally = msgEvents.reduce((a, r) => ((a[r.event_type] = (a[r.event_type] ?? 0) + 1), a), {});

  // 5. error_logs (created_at, not occurred_at)
  const sinceCreatedAt = earliestSentAt ?? eventRow.start_at;
  const { data: errLogs, error: errLogsErr } = await admin
    .from('error_logs')
    .select('id, endpoint, error_code, error_message, context, created_at')
    .eq('endpoint', '/api/webhooks/resend')
    .gte('created_at', sinceCreatedAt)
    .order('created_at', { ascending: false });
  if (errLogsErr) throw new Error(`error_logs: ${errLogsErr.message}`);
  const errLogTally = errLogs.reduce((a, r) => {
    const k = `${r.error_code ?? 'null'}`;
    a[k] = (a[k] ?? 0) + 1;
    return a;
  }, {});

  // 6. Resend API read-back (read-scoped key preferred)
  const resendStatusTally = {};
  let resendApiOk = 0, resendApiFail = 0;
  const resendDetails = [];
  if (RESEND_READ_KEY) {
    for (const id of resendIds) {
      try {
        const res = await fetch(`https://api.resend.com/emails/${id}`, {
          headers: { Authorization: `Bearer ${RESEND_READ_KEY}` },
        });
        if (!res.ok) {
          resendApiFail++;
          const body = await res.text();
          resendDetails.push({ id, http_status: res.status, error: body.slice(0, 200) });
          resendStatusTally[`http_${res.status}`] = (resendStatusTally[`http_${res.status}`] ?? 0) + 1;
          continue;
        }
        const body = await res.json();
        resendApiOk++;
        const last_event = body.last_event ?? body.last_status ?? body.status ?? 'unknown';
        resendDetails.push({ id, to: Array.isArray(body.to) ? body.to[0] : body.to, last_event, created_at: body.created_at });
        resendStatusTally[last_event] = (resendStatusTally[last_event] ?? 0) + 1;
      } catch (e) {
        resendApiFail++;
        resendStatusTally['fetch_error'] = (resendStatusTally['fetch_error'] ?? 0) + 1;
      }
    }
  }

  // 7. Verdict
  let verdict;
  if (msgEvents.length > 0) verdict = 'live-proceed';
  else if (errLogs.length > 0) verdict = 'invoked-failing';
  else verdict = 'not invoked';

  return {
    eventRow,
    invites_total: invites.length,
    invite_status_tally: invites.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {}),
    msg_logs_total: msgLogs.length,
    send_mode_tally: sendModeTally,
    earliest_sent_at: earliestSentAt,
    latest_sent_at: latestSentAt,
    message_log_ids: messageLogIds,
    resend_ids: resendIds,
    msg_event_count: msgEvents.length,
    msg_event_tally: msgEventTally,
    err_log_count: errLogs.length,
    err_log_tally: errLogTally,
    resend_status_tally: resendStatusTally,
    resend_api_ok: resendApiOk,
    resend_api_fail: resendApiFail,
    resend_details: resendDetails,
    verdict,
  };
}

function printPass(p) {
  section(`Event ${p.eventRow.id}`);
  console.log(`title: ${p.eventRow.title}`);
  console.log(`start_at: ${p.eventRow.start_at}  end_at: ${p.eventRow.end_at}`);
  console.log(`event_invites total: ${p.invites_total}  by status: ${JSON.stringify(p.invite_status_tally)}`);
  console.log(`messages_log rows: ${p.msg_logs_total}  send_mode: ${JSON.stringify(p.send_mode_tally)}`);
  console.log(`send window: ${p.earliest_sent_at} -> ${p.latest_sent_at}`);
  console.log(`resolved resend_message_ids: ${p.resend_ids.length}`);

  section('message_events tally');
  console.log(`total: ${p.msg_event_count}  by event_type: ${JSON.stringify(p.msg_event_tally)}`);

  section('error_logs (/api/webhooks/resend, since send window start)');
  console.log(`total: ${p.err_log_count}  by error_code: ${JSON.stringify(p.err_log_tally)}`);

  section('Resend API status (read-scoped key if configured)');
  console.log(`API calls: ${p.resend_api_ok} ok, ${p.resend_api_fail} fail`);
  console.log(`status tally: ${JSON.stringify(p.resend_status_tally)}`);

  section('VERDICT');
  console.log(`verdict: ${p.verdict}`);
  console.log(`  message_events: ${p.msg_event_count}`);
  console.log(`  error_logs: ${p.err_log_count}`);
  console.log(`  resend api ok: ${p.resend_api_ok}, fail: ${p.resend_api_fail}`);
}

// ---------------------------------------------------------------------------
// Append results block to plan file
// ---------------------------------------------------------------------------
function appendPlanBlock(p, selfHealResults) {
  if (!APPEND_PLAN) return;
  if (!existsSync(PLAN_PATH)) {
    console.log(`  plan file not found at ${PLAN_PATH}; skipping append`);
    return;
  }
  const stamp = new Date().toISOString();
  const block = [
    '',
    '---',
    '',
    `## Phase 3.3 autonomous re-run -- ${stamp}`,
    '',
    `EVENT_ID: ${p.eventRow.id}`,
    `verdict: **${p.verdict}**`,
    '',
    `- message_events: ${p.msg_event_count} (by event_type: ${JSON.stringify(p.msg_event_tally)})`,
    `- error_logs (/api/webhooks/resend): ${p.err_log_count} (by code: ${JSON.stringify(p.err_log_tally)})`,
    `- resend api: ${p.resend_api_ok} ok, ${p.resend_api_fail} fail (status: ${JSON.stringify(p.resend_status_tally)})`,
  ];
  if (selfHealResults?.resend) {
    block.push(`- resend webhook config self-verify: healthy=${selfHealResults.resend.healthy} reason=${selfHealResults.resend.reason}`);
  }
  if (selfHealResults?.vercel) {
    block.push(`- vercel function logs: hits=${selfHealResults.vercel.hits ?? 'n/a'} classification=${selfHealResults.vercel.classification ?? selfHealResults.vercel.reason}`);
  }
  block.push('');
  appendFileSync(PLAN_PATH, block.join('\n'));
  console.log(`  appended results block to ${PLAN_PATH}`);
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
console.log(`phase-033 triage  EVENT_ID=${EVENT_ID}  watch=${WATCH}  self-heal=${SELF_HEAL}  append-plan=${APPEND_PLAN}`);

await preflightSchema();

let selfHealResults = {};
if (SELF_HEAL) {
  selfHealResults.resend = await resendWebhookSelfVerify();
}

let pass = await runTriagePass(EVENT_ID);
printPass(pass);

if (WATCH && pass.verdict === 'not invoked') {
  section(`Watching for state change (interval=${INTERVAL_S}s, timeout=${TIMEOUT_S}s)`);
  const startMs = Date.now();
  while (pass.verdict === 'not invoked' && (Date.now() - startMs) / 1000 < TIMEOUT_S) {
    await sleep(INTERVAL_S * 1000);
    pass = await runTriagePass(EVENT_ID);
    const elapsed = Math.floor((Date.now() - startMs) / 1000);
    console.log(`  [t+${elapsed}s] verdict=${pass.verdict}  msg_events=${pass.msg_event_count}  err_logs=${pass.err_log_count}`);
    if (pass.verdict !== 'not invoked') break;
  }
  section('Watch loop exit');
  printPass(pass);
}

if (SELF_HEAL && pass.verdict === 'not invoked') {
  selfHealResults.vercel = await vercelFunctionLogs(pass.earliest_sent_at ?? pass.eventRow.start_at);
}

appendPlanBlock(pass, selfHealResults);

process.exit(pass.verdict === 'live-proceed' ? 0 : 1);
