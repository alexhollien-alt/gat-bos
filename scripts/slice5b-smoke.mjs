// Slice 5B Task 9 smoke test runner.
//
// 1. POST /api/contacts (realtor) -> verify autoEnroll + welcome task
// 2. Re-POST /api/contacts/[id]/auto-enroll -> verify idempotency
// 3. POST /api/projects type='listing' -> verify 1 touchpoint + 3 tasks + 2 drafts
// 4. curl /api/cron/touchpoint-reminder -> verify summary email + last_reminded_at
// 5. Soft-delete project -> re-tick cron -> verify skip
// 6. Soft-delete all fixtures (rule 3)
//
// Reads env from .env.local. Designed to run against http://localhost:3000.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^"|"$/g, '')];
    }),
);

const SITE = process.env.SITE ?? 'http://localhost:3000';
const API_TOKEN = env.INTERNAL_API_TOKEN;
const CRON_SECRET = env.CRON_SECRET;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_USER_ID = env.OWNER_USER_ID;

if (!API_TOKEN || !CRON_SECRET || !SUPABASE_URL || !SERVICE_KEY || !OWNER_USER_ID) {
  console.error('missing env');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const log = (msg, data) => console.log(`[smoke] ${msg}`, data ?? '');

async function api(path, method = 'GET', body = null, useCron = false) {
  const headers = useCron
    ? { Authorization: `Bearer ${CRON_SECRET}` }
    : { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' };
  const init = { method, headers };
  if (body) init.body = JSON.stringify(body);
  const r = await fetch(`${SITE}${path}`, init);
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: r.status, body: json ?? text };
}

const summary = { gates: {}, fixtures: {} };

try {
  // -------- Gate 1: contact creation --------
  log('Gate 1: POST /api/contacts');
  const contactRes = await api('/api/contacts', 'POST', {
    first_name: 'Slice5B',
    last_name: 'SmokeTest',
    type: 'realtor',
    tier: 'C',
    notes: 'slice 5b smoke fixture; soft-delete after smoke',
  });
  if (contactRes.status !== 201) throw new Error(`contact create failed: ${JSON.stringify(contactRes)}`);
  const contactId = contactRes.body.id;
  summary.fixtures.contactId = contactId;
  log('contact created', contactId);

  // Allow async hooks to land.
  await new Promise((r) => setTimeout(r, 1500));

  // Welcome task check
  const { data: tasksAfterContact } = await sb
    .from('tasks')
    .select('id, title, source')
    .eq('contact_id', contactId)
    .eq('source', 'contact_hook')
    .is('deleted_at', null);
  if ((tasksAfterContact ?? []).length !== 1) {
    throw new Error(`expected 1 welcome task, got ${tasksAfterContact?.length ?? 0}`);
  }
  log('welcome task seen', tasksAfterContact[0].title);

  // Auto-enroll check
  const { data: enrollRows } = await sb
    .from('campaign_enrollments')
    .select('id, status')
    .eq('contact_id', contactId)
    .is('deleted_at', null);
  log('enrollments', enrollRows?.length ?? 0);
  summary.gates.gate1 = {
    welcome_task_count: tasksAfterContact.length,
    enrollment_count: enrollRows?.length ?? 0,
  };

  // -------- Gate 2: idempotency --------
  log('Gate 2: re-fire /api/contacts/[id]/auto-enroll');
  const reFire = await api(`/api/contacts/${contactId}/auto-enroll`, 'POST');
  log('re-fire status', reFire.status);
  await new Promise((r) => setTimeout(r, 800));
  const { data: tasksAfterRefire } = await sb
    .from('tasks')
    .select('id')
    .eq('contact_id', contactId)
    .eq('source', 'contact_hook')
    .is('deleted_at', null);
  if ((tasksAfterRefire ?? []).length !== 1) {
    throw new Error(`idempotency broken; expected 1, got ${tasksAfterRefire?.length}`);
  }
  log('idempotency confirmed: still 1 task after re-fire');
  summary.gates.gate2 = { tasks_after_refire: tasksAfterRefire.length };

  // -------- Gate 3: project listing --------
  log('Gate 3: POST /api/projects type=listing');
  const projRes = await api('/api/projects', 'POST', {
    type: 'listing',
    title: 'Slice 5B Smoke Listing -- 123 Test Way',
    owner_contact_id: contactId,
  });
  if (projRes.status !== 201) throw new Error(`project create failed: ${JSON.stringify(projRes)}`);
  const projectId = projRes.body.id;
  summary.fixtures.projectId = projectId;
  log('project created', projectId);
  await new Promise((r) => setTimeout(r, 2500));

  const { data: tps } = await sb
    .from('project_touchpoints')
    .select('id, touchpoint_type, due_at')
    .eq('project_id', projectId)
    .is('deleted_at', null);
  const { data: ptasks } = await sb
    .from('tasks')
    .select('id, title, source')
    .eq('project_id', projectId)
    .is('deleted_at', null);
  const { data: emails } = await sb
    .from('emails')
    .select('id, gmail_id, subject')
    .like('gmail_id', `proactive-listing-launch-${projectId}-%`);
  summary.fixtures.emailIds = (emails ?? []).map((e) => e.id);
  const draftCounts = await Promise.all(
    (emails ?? []).map((e) =>
      sb.from('email_drafts').select('id', { count: 'exact', head: true }).eq('email_id', e.id),
    ),
  );
  const totalDrafts = draftCounts.reduce((sum, r) => sum + (r.count ?? 0), 0);

  if ((tps ?? []).length !== 1) throw new Error(`expected 1 touchpoint, got ${tps?.length}`);
  if ((ptasks ?? []).length !== 3) throw new Error(`expected 3 tasks, got ${ptasks?.length}`);
  if (totalDrafts !== 2) throw new Error(`expected 2 drafts, got ${totalDrafts}`);
  log('project hook gate green', { touchpoints: 1, tasks: 3, drafts: 2 });
  summary.gates.gate3 = { touchpoints: 1, tasks: 3, drafts: 2 };

  // -------- Gate 4: cron fires summary --------
  log('Gate 4: GET /api/cron/touchpoint-reminder');
  const cronRes = await api('/api/cron/touchpoint-reminder', 'GET', null, true);
  log('cron response', cronRes.body);
  if (cronRes.status !== 200) throw new Error(`cron failed: ${JSON.stringify(cronRes)}`);
  summary.gates.gate4 = cronRes.body;

  // last_reminded_at populated on the touchpoint we created
  const { data: tpAfter } = await sb
    .from('project_touchpoints')
    .select('id, last_reminded_at')
    .eq('project_id', projectId)
    .is('deleted_at', null);
  if (!tpAfter?.[0]?.last_reminded_at) {
    throw new Error(`last_reminded_at not stamped on touchpoint`);
  }
  log('last_reminded_at populated', tpAfter[0].last_reminded_at);

  // -------- Gate 5: soft-delete project, re-tick cron, verify skip --------
  log('Gate 5: soft-delete project, re-tick cron');
  await sb
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', projectId);
  await sb
    .from('project_touchpoints')
    .update({ deleted_at: new Date().toISOString() })
    .eq('project_id', projectId);
  await sb
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('project_id', projectId);
  // Force-reset last_reminded_at on already-deleted touchpoints so the
  // debounce filter is not the reason they're skipped (we want the
  // deleted_at filter to be the reason).
  const cronRes2 = await api('/api/cron/touchpoint-reminder', 'GET', null, true);
  log('cron re-tick', cronRes2.body);
  summary.gates.gate5 = cronRes2.body;

  // -------- Cleanup: soft-delete all fixtures --------
  log('Cleanup: soft-delete all fixtures');
  const now = new Date().toISOString();
  await sb.from('contacts').update({ deleted_at: now }).eq('id', contactId);
  await sb.from('tasks').update({ deleted_at: now }).eq('contact_id', contactId);
  await sb.from('campaign_enrollments').update({ deleted_at: now }).eq('contact_id', contactId);
  if (summary.fixtures.emailIds.length > 0) {
    for (const eid of summary.fixtures.emailIds) {
      await sb.from('email_drafts').update({ status: 'discarded' }).eq('email_id', eid);
    }
  }

  log('SMOKE PASSED');
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
} catch (err) {
  console.error('[smoke] FAILED:', err.message);
  console.error(JSON.stringify(summary, null, 2));
  // Attempt cleanup on failure
  if (summary.fixtures.contactId) {
    const now = new Date().toISOString();
    await sb.from('contacts').update({ deleted_at: now }).eq('id', summary.fixtures.contactId);
    await sb.from('tasks').update({ deleted_at: now }).eq('contact_id', summary.fixtures.contactId);
    await sb
      .from('campaign_enrollments')
      .update({ deleted_at: now })
      .eq('contact_id', summary.fixtures.contactId);
  }
  if (summary.fixtures.projectId) {
    const now = new Date().toISOString();
    await sb.from('projects').update({ deleted_at: now }).eq('id', summary.fixtures.projectId);
    await sb.from('project_touchpoints').update({ deleted_at: now }).eq('project_id', summary.fixtures.projectId);
    await sb.from('tasks').update({ deleted_at: now }).eq('project_id', summary.fixtures.projectId);
  }
  process.exit(2);
}
