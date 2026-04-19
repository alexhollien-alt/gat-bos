#!/usr/bin/env node
/**
 * GAT-BOS 1.3.1 Phase 6 Step 5 -- RLS verification on projects + project_touchpoints.
 *
 * Plan: ~/.claude/plans/gat-bos-1.3.1-gmail-mvp.md (Phase 6 acceptance gate, bullet 4).
 * Policy under test: alex_projects_all / alex_touchpoints_all on
 *   auth.jwt() ->> 'email' = 'alex@alexhollienco.com'.
 *
 * Strategy:
 *   1. Admin (service role) creates a second test user (email != alex).
 *   2. Sign in as that user via the anon client, capture JWT.
 *   3. Build a user-scoped client with that JWT.
 *   4. SELECT from projects + project_touchpoints -> expect 0 rows.
 *   5. Attempt INSERT into each -> expect RLS denial.
 *   6. Soft-ban the test user (standing rule 3 -- no hard deletes).
 *
 * Exit 0 = GREEN. Non-zero = gate fails.
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
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error('Missing Supabase env vars in ~/crm/.env.local');
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const TEST_EMAIL = 'rls-test-negative@gatbos.local';
const TEST_PASSWORD = 'Phase6Step5-RLS-Test-2026';

const findings = [];
let failures = 0;
const fail = (label, detail) => {
  failures++;
  findings.push(`FAIL  ${label}  ${detail ?? ''}`);
};
const pass = (label, detail) => findings.push(`PASS  ${label}  ${detail ?? ''}`);

// --- baseline: Alex's data exists (service role bypasses RLS) ---
const { data: alexProjects, error: alexPErr } = await admin
  .from('projects')
  .select('id')
  .is('deleted_at', null);
if (alexPErr) {
  fail('baseline projects read (service role)', alexPErr.message);
  process.exit(1);
}
const alexProjectCount = alexProjects?.length ?? 0;

const { data: alexTPs, error: alexTErr } = await admin
  .from('project_touchpoints')
  .select('id');
if (alexTErr) {
  fail('baseline touchpoints read (service role)', alexTErr.message);
  process.exit(1);
}
const alexTouchpointCount = alexTPs?.length ?? 0;

if (alexProjectCount === 0 || alexTouchpointCount === 0) {
  console.error(
    `Pre-req: expected alex projects>0 and touchpoints>0. Got p=${alexProjectCount} t=${alexTouchpointCount}. Run Phase 6 seed first.`
  );
  process.exit(1);
}
pass('baseline (service role)', `alex_projects=${alexProjectCount} alex_touchpoints=${alexTouchpointCount}`);

// --- create or fetch the negative-test user ---
let testUserId;
{
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 200 });
  const match = existing?.users?.find((u) => u.email === TEST_EMAIL);
  if (match) {
    testUserId = match.id;
    // ensure unbanned + password known
    await admin.auth.admin.updateUserById(testUserId, {
      password: TEST_PASSWORD,
      ban_duration: 'none',
      email_confirm: true,
    });
    pass('test user (reused)', `id=${testUserId}`);
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      fail('create test user', createErr?.message);
      process.exit(1);
    }
    testUserId = created.user.id;
    pass('test user (new)', `id=${testUserId}`);
  }
}

// --- sign in as the test user via anon client ---
const anonForSignIn = createClient(URL, ANON, { auth: { persistSession: false } });
const { data: signIn, error: signInErr } = await anonForSignIn.auth.signInWithPassword({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
});
if (signInErr || !signIn?.session?.access_token) {
  fail('sign in as test user', signInErr?.message);
  process.exit(1);
}
const accessToken = signIn.session.access_token;
pass('sign in as test user');

// --- user-scoped client carries the test user's JWT ---
const asTestUser = createClient(URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${accessToken}` } },
});

// --- assertion 1: SELECT projects as non-alex returns 0 rows ---
{
  const { data, error } = await asTestUser.from('projects').select('id');
  if (error) {
    // Some RLS setups error instead of returning empty; treat as pass if the error is RLS-shaped.
    if (/row-level security|permission denied/i.test(error.message)) {
      pass('projects SELECT denied (error)', error.message);
    } else {
      fail('projects SELECT unexpected error', error.message);
    }
  } else if ((data?.length ?? 0) === 0) {
    pass('projects SELECT returns 0 rows');
  } else {
    fail('projects SELECT leaked rows', `got ${data.length}`);
  }
}

// --- assertion 2: SELECT project_touchpoints as non-alex returns 0 rows ---
{
  const { data, error } = await asTestUser.from('project_touchpoints').select('id');
  if (error) {
    if (/row-level security|permission denied/i.test(error.message)) {
      pass('project_touchpoints SELECT denied (error)', error.message);
    } else {
      fail('project_touchpoints SELECT unexpected error', error.message);
    }
  } else if ((data?.length ?? 0) === 0) {
    pass('project_touchpoints SELECT returns 0 rows');
  } else {
    fail('project_touchpoints SELECT leaked rows', `got ${data.length}`);
  }
}

// --- assertion 3: INSERT projects as non-alex is blocked by WITH CHECK ---
{
  const { data, error } = await asTestUser
    .from('projects')
    .insert({ type: 'other', title: 'RLS probe -- should be denied' })
    .select();
  if (error) {
    pass('projects INSERT denied', error.message);
  } else {
    fail('projects INSERT unexpectedly succeeded', `inserted id=${data?.[0]?.id}`);
    // clean up the leak via service role
    if (data?.[0]?.id) {
      await admin.from('projects').delete().eq('id', data[0].id);
    }
  }
}

// --- assertion 4: INSERT project_touchpoints as non-alex is blocked ---
{
  const { data, error } = await asTestUser.from('project_touchpoints').insert({
    project_id: alexProjects[0].id,
    touchpoint_type: 'email',
    entity_id: alexProjects[0].id, // any UUID
    entity_table: 'email_drafts',
  }).select();
  if (error) {
    pass('project_touchpoints INSERT denied', error.message);
  } else {
    fail('project_touchpoints INSERT unexpectedly succeeded', `inserted id=${data?.[0]?.id}`);
    if (data?.[0]?.id) {
      await admin.from('project_touchpoints').delete().eq('id', data[0].id);
    }
  }
}

// --- soft-clean: ban the test user (rule 3: no hard delete) ---
{
  const { error: banErr } = await admin.auth.admin.updateUserById(testUserId, {
    ban_duration: '876000h', // ~100 years
  });
  if (banErr) {
    findings.push(`WARN  soft-ban test user  ${banErr.message}`);
  } else {
    pass('soft-ban test user', `id=${testUserId}`);
  }
}

// --- report ---
console.log('\n=== Phase 6 Step 5 RLS Test ===');
for (const line of findings) console.log(line);
console.log(`\n${failures === 0 ? 'GREEN' : `RED (${failures} failure${failures === 1 ? '' : 's'})`}`);
process.exit(failures === 0 ? 0 : 1);
