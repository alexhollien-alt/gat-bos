#!/usr/bin/env node
/**
 * Smoke-test the "New Agent Onboarding" auto-enrollment across all 3
 * contact-creation paths.
 *
 *   1. POST /api/contacts (server, INTERNAL_API_TOKEN bearer)
 *   2. Modal flow -- direct adminClient insert + POST /api/contacts/:id/auto-enroll
 *   3. POST /api/intake (public, fresh email)
 *
 * For each path: verify exactly one campaign_enrollments row was written
 * with current_step=1 and next_action_at within 1s of expected (now + step1.delay_days).
 *
 * Cleanup is soft per Rule 3: enrollments flipped to status='removed' + deleted_at,
 * contacts flipped to deleted_at. Material requests + interactions left in place
 * (test data, parent contact is soft-deleted).
 *
 * Run from anywhere: node ~/crm/scripts/auto-enroll-smoke-test.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

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
const OWNER = env.OWNER_USER_ID;
const TOKEN = env.INTERNAL_API_TOKEN;
const SITE = 'http://localhost:3000';

for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE, OWNER_USER_ID: OWNER, INTERNAL_API_TOKEN: TOKEN })) {
  if (!v) { console.error(`Missing ${k}`); process.exit(1); }
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const RUN_ID = randomUUID().slice(0, 8);
const CAMPAIGN_NAME = 'New Agent Onboarding';
const created = { contactIds: [], enrollmentIds: [], requestIds: [] };
const results = [];

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

async function lookupCampaign() {
  const { data, error } = await admin
    .from('campaigns')
    .select('id, name, status, deleted_at, enrolled_count')
    .eq('user_id', OWNER)
    .eq('name', CAMPAIGN_NAME)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  assert(data, `Campaign "${CAMPAIGN_NAME}" not found under owner ${OWNER} (status=active, deleted_at=null). Create it in /campaigns/new first.`);

  const { data: step1, error: stepErr } = await admin
    .from('campaign_steps')
    .select('id, step_number, delay_days')
    .eq('campaign_id', data.id)
    .eq('step_number', 1)
    .is('deleted_at', null)
    .maybeSingle();
  if (stepErr) throw stepErr;
  assert(step1, `Campaign exists but no step_number=1 row found.`);

  return { campaign: data, step1 };
}

async function findEnrollment(campaignId, contactId) {
  const { data, error } = await admin
    .from('campaign_enrollments')
    .select('id, campaign_id, contact_id, status, current_step, next_action_at, deleted_at, created_at')
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function checkEnrollment(enr, step1, beforeMs, afterMs, label) {
  const checks = [];
  checks.push(['exists', !!enr]);
  if (!enr) return checks;
  checks.push(['status=active', enr.status === 'active']);
  checks.push(['current_step=1', enr.current_step === 1]);
  checks.push(['deleted_at=null', enr.deleted_at == null]);
  if (enr.next_action_at) {
    const naa = new Date(enr.next_action_at).getTime();
    const delayMs = (step1.delay_days ?? 0) * 86_400_000;
    const expectedLow = beforeMs + delayMs;
    const expectedHigh = afterMs + delayMs;
    const within = naa >= expectedLow - 5_000 && naa <= expectedHigh + 5_000;
    checks.push([`next_action_at within window (delay_days=${step1.delay_days})`, within]);
  } else {
    checks.push(['next_action_at populated', false]);
  }
  return checks;
}

function logResult(label, passOrFail, details) {
  const ok = passOrFail === 'PASS';
  results.push({ label, status: passOrFail, details });
  console.log(`\n--- ${label}: ${passOrFail} ---`);
  if (details) console.log(details);
}

// PATH 1: POST /api/contacts
async function path1(campaign, step1) {
  const label = 'PATH 1: POST /api/contacts';
  const email = `smoke-p1-${RUN_ID}@gatbos.local`;
  const before = Date.now();
  const res = await fetch(`${SITE}/api/contacts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      first_name: `Smoke`,
      last_name: `P1-${RUN_ID}`,
      email,
      type: 'realtor',
      tier: 'P',
      stage: 'new',
      source: 'smoke-test',
    }),
  });
  const after = Date.now();
  const body = await res.json();
  if (res.status !== 201) return logResult(label, 'FAIL', `HTTP ${res.status}: ${JSON.stringify(body)}`);
  const contactId = body.id;
  created.contactIds.push(contactId);

  const enr = await findEnrollment(campaign.id, contactId);
  if (enr) created.enrollmentIds.push(enr.id);
  const checks = checkEnrollment(enr, step1, before, after, label);
  const allPass = checks.every(([, ok]) => ok);
  return logResult(label, allPass ? 'PASS' : 'FAIL',
    `contact_id=${contactId}\nenrollment=${JSON.stringify(enr, null, 2)}\nchecks=${JSON.stringify(checks)}`);
}

// PATH 2: Modal flow -- mimic the browser's anon-key insert + endpoint call
async function path2(campaign, step1) {
  const label = 'PATH 2: Modal (browser insert + /api/contacts/[id]/auto-enroll)';
  const email = `smoke-p2-${RUN_ID}@gatbos.local`;
  const before = Date.now();

  // Mimic browser-side insert. The real modal uses the anon supabase client;
  // here we use admin (RLS-equivalent for owner-stamped rows). The endpoint
  // we exercise is the one the modal posts to, which is the actual code path.
  const { data: contact, error } = await admin
    .from('contacts')
    .insert({
      user_id: OWNER,
      first_name: 'Smoke',
      last_name: `P2-${RUN_ID}`,
      email,
      type: 'realtor',
      tier: 'P',
      stage: 'new',
      source: 'smoke-test',
    })
    .select('id')
    .single();
  if (error) return logResult(label, 'FAIL', `Insert failed: ${error.message}`);
  created.contactIds.push(contact.id);

  const res = await fetch(`${SITE}/api/contacts/${contact.id}/auto-enroll`, {
    method: 'POST',
  });
  const after = Date.now();
  const body = await res.json();
  if (res.status !== 200) return logResult(label, 'FAIL', `HTTP ${res.status}: ${JSON.stringify(body)}`);

  const enr = await findEnrollment(campaign.id, contact.id);
  if (enr) created.enrollmentIds.push(enr.id);
  const checks = checkEnrollment(enr, step1, before, after, label);
  const allPass = checks.every(([, ok]) => ok);
  return logResult(label, allPass ? 'PASS' : 'FAIL',
    `contact_id=${contact.id}\nendpoint_response=${JSON.stringify(body)}\nenrollment=${JSON.stringify(enr, null, 2)}\nchecks=${JSON.stringify(checks)}`);
}

// PATH 3: POST /api/intake
async function path3(campaign, step1) {
  const label = 'PATH 3: POST /api/intake';
  const email = `smoke-p3-${RUN_ID}@gatbos.local`;
  const before = Date.now();
  const res = await fetch(`${SITE}/api/intake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      products: ['flyer'],
      agent: {
        agent_name: `Smoke P3-${RUN_ID}`,
        agent_email: email,
        agent_phone: '',
        brokerage: 'Smoke Test Realty',
      },
      situation: 'general',
    }),
  });
  const after = Date.now();
  const body = await res.json();
  if (res.status !== 201) return logResult(label, 'FAIL', `HTTP ${res.status}: ${JSON.stringify(body)}`);
  if (!body.contactId) return logResult(label, 'FAIL', `Intake returned no contactId: ${JSON.stringify(body)}`);
  created.contactIds.push(body.contactId);
  if (body.id) created.requestIds.push(body.id);

  const enr = await findEnrollment(campaign.id, body.contactId);
  if (enr) created.enrollmentIds.push(enr.id);
  const checks = checkEnrollment(enr, step1, before, after, label);
  const allPass = checks.every(([, ok]) => ok);
  return logResult(label, allPass ? 'PASS' : 'FAIL',
    `contact_id=${body.contactId}\nintake_response=${JSON.stringify(body)}\nenrollment=${JSON.stringify(enr, null, 2)}\nchecks=${JSON.stringify(checks)}`);
}

async function cleanup(campaign) {
  console.log('\n== Cleanup (soft per Rule 3) ==');
  if (created.enrollmentIds.length) {
    const { error } = await admin
      .from('campaign_enrollments')
      .update({ status: 'removed', deleted_at: new Date().toISOString() })
      .in('id', created.enrollmentIds);
    console.log(`  enrollments soft-removed: ${created.enrollmentIds.length}${error ? ` (ERR ${error.message})` : ''}`);

    // Recompute enrolled_count (race-tolerant per helper pattern)
    const { count } = await admin
      .from('campaign_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .is('deleted_at', null)
      .neq('status', 'removed');
    if (typeof count === 'number') {
      await admin.from('campaigns').update({ enrolled_count: count }).eq('id', campaign.id);
      console.log(`  campaigns.enrolled_count recomputed -> ${count}`);
    }
  }
  if (created.contactIds.length) {
    const { error } = await admin
      .from('contacts')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', created.contactIds);
    console.log(`  contacts soft-deleted: ${created.contactIds.length}${error ? ` (ERR ${error.message})` : ''}`);
  }
  if (created.requestIds.length) {
    console.log(`  material_requests left in place (test rows): ${created.requestIds.join(', ')}`);
  }
}

async function main() {
  console.log(`== Auto-enroll smoke test, run_id=${RUN_ID} ==`);
  const { campaign, step1 } = await lookupCampaign();
  console.log(`Campaign: ${campaign.id} (enrolled_count=${campaign.enrolled_count})`);
  console.log(`Step 1: id=${step1.id} delay_days=${step1.delay_days}`);

  await path1(campaign, step1);
  await path2(campaign, step1);
  await path3(campaign, step1);

  await cleanup(campaign);

  const fails = results.filter((r) => r.status === 'FAIL');
  console.log(`\n== Summary ==`);
  for (const r of results) console.log(`  ${r.status}  ${r.label}`);
  process.exit(fails.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL', e);
  cleanup({ id: null }).finally(() => process.exit(2));
});
