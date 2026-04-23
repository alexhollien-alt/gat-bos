#!/usr/bin/env node
/**
 * GAT Event Cycle Step 4 -- fix + re-seed.
 *
 * Prior run failed with P0001 "Missing contact: Alex Hollien". This script:
 *   1. Verifies Alex Hollien is absent in public.contacts.
 *   2. Inserts a minimal contacts row for Alex (escrow/active_partner, GAT brokerage,
 *      user_id = alex@alexhollienco.com auth uid). Idempotent: skip if present.
 *   3. Resolves owner_contact_id for Alex, Christine, Stephanie.
 *   4. Mirrors the 9 INSERTs from the archived seed SQL verbatim (values/notes match).
 *      Wipes event_templates first (re-runnable: FK on events.event_template_id is
 *      ON DELETE SET NULL and no occurrences exist yet at Step 4).
 *   5. Verifies count = 9 + runs the 7 VERIFY queries from the archived SQL.
 *
 * Source of truth for row values:
 *   ~/Archive/paste-files/2026-04/PASTE-INTO-SUPABASE-event-cycle-step-4-seed.sql
 * Plan:
 *   ~/.claude/plans/event-cycle-build.md (Step 4)
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
    .map((l) => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ALEX_AUTH_UID = 'b735d691-4d86-4e31-9fd3-c2257822dca3'; // confirmed via auth.admin.listUsers()

function fail(msg) { console.error(`❌ ${msg}`); process.exit(1); }
function ok(msg)   { console.log(`✓ ${msg}`); }

// ---------- 1. Verify Alex is absent ----------
console.log('\n[1] Verifying Alex Hollien is absent ...');
{
  const { data, error } = await admin.from('contacts')
    .select('id')
    .eq('first_name', 'Alex').eq('last_name', 'Hollien').is('deleted_at', null);
  if (error) fail(`contacts pre-check: ${error.message}`);
  if (data.length > 0) {
    ok(`Alex already present (id=${data[0].id}); skipping insert.`);
  } else {
    // ---------- 2. Insert Alex ----------
    console.log('[2] Inserting contacts row for Alex Hollien ...');
    const { data: ins, error: insErr } = await admin.from('contacts').insert({
      first_name: 'Alex',
      last_name: 'Hollien',
      email: 'alex@alexhollienco.com',
      type: 'escrow',              // title/escrow side; enum values: escrow|lender|realtor|vendor
      stage: 'active_partner',     // matches Christine/Stephanie shape
      brokerage: 'Great American Title Agency',
      user_id: ALEX_AUTH_UID,
    }).select('id, first_name, last_name, email, type, stage, brokerage, user_id').single();
    if (insErr) fail(`insert Alex: ${insErr.message}`);
    ok(`Inserted Alex: id=${ins.id}`);
    console.log('   row:', ins);
  }
}

// ---------- 3. Resolve owner FKs ----------
console.log('\n[3] Resolving owner_contact_id for all 3 owners ...');
async function lookup(first, last) {
  const { data, error } = await admin.from('contacts')
    .select('id').eq('first_name', first).eq('last_name', last).is('deleted_at', null).single();
  if (error) fail(`lookup ${first} ${last}: ${error.message}`);
  return data.id;
}
const alexId      = await lookup('Alex', 'Hollien');
const christineId = await lookup('Christine', 'McConnell');
const stephanieId = await lookup('Stephanie', 'Reid');
ok(`Alex=${alexId}`);
ok(`Christine=${christineId}`);
ok(`Stephanie=${stephanieId}`);

// ---------- 4. Wipe + seed 9 event_templates ----------
console.log('\n[4] Wiping event_templates ...');
{
  const { error } = await admin.from('event_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) fail(`wipe: ${error.message}`);
  ok('wiped');
}

console.log('[4] Inserting 9 event_templates (mirror of archived SQL) ...');
const rows = [
  {
    name: 'Desert Ridge Home Tour',
    owner_contact_id: stephanieId,
    week_of_month: 1, day_of_week: 3,
    start_time: '09:00', end_time: '11:30',
    location_type: 'fixed', default_location: 'Desert Ridge GAT Office',
    lender_flag: 'stephanie',
    notes: null,
  },
  {
    name: 'Content Day',
    owner_contact_id: christineId,
    week_of_month: 1, day_of_week: 4,
    start_time: '10:00', end_time: '13:00',
    location_type: 'rotating', default_location: null,
    lender_flag: 'christine',
    notes: 'Hosted at an active listing each month. Step 7 monthly confirm flow resolves location_override on the spawned occurrence.',
  },
  {
    name: 'Connections & Cocktails',
    owner_contact_id: christineId,
    week_of_month: 2, day_of_week: 2,
    start_time: '16:30', end_time: '18:00',
    location_type: 'rotating', default_location: null,
    lender_flag: 'christine',
    notes: 'Venue TBD per month. Step 7 monthly confirm flow resolves location_override on the spawned occurrence.',
  },
  {
    name: '85254 Home Tour',
    owner_contact_id: alexId,
    week_of_month: 2, day_of_week: 3,
    start_time: '09:00', end_time: '12:00',
    location_type: 'fixed', default_location: 'Paradise Valley Office Park',
    lender_flag: 'none',
    notes: 'SAAR partnership -- contact reference only, no org record.',
  },
  {
    name: 'Class Day',
    owner_contact_id: stephanieId,
    week_of_month: 2, day_of_week: 4,
    start_time: '10:00', end_time: '13:00',
    location_type: 'fixed', default_location: 'Desert Ridge GAT Office',
    lender_flag: 'stephanie',
    notes: 'End time 12:00 or 13:00 depending on session length; calendar block ends 13:00.\nRotates: Pipeline track (#1 Farming Strategy, #2 Build Q3 Pipeline, #3 CRM Systems, #4 Business Planning) then Conversion track (#1 Open House Conversion strategy, #2 Open House Class drill scripts), then repeats.',
  },
  {
    name: '85258 Home Tour',
    owner_contact_id: christineId,
    week_of_month: 3, day_of_week: 3,
    start_time: '09:00', end_time: '11:30',
    location_type: 'rotating', default_location: null,
    lender_flag: 'christine',
    notes: "Meet-point is the first home on each month's route. Step 7 monthly confirm flow resolves location_override on the spawned occurrence.",
  },
  {
    name: 'Content Day',
    owner_contact_id: stephanieId,
    week_of_month: 3, day_of_week: 4,
    start_time: '10:00', end_time: '13:00',
    location_type: 'rotating', default_location: null,
    lender_flag: 'stephanie',
    notes: 'End time 12:00 or 13:00 depending on session length; calendar block ends 13:00.\nHosted at an active listing each month. Step 7 monthly confirm flow resolves location_override on the spawned occurrence.',
  },
  {
    name: 'Happy Hour',
    owner_contact_id: stephanieId,
    week_of_month: 4, day_of_week: 2,
    start_time: '16:30', end_time: '18:00',
    location_type: 'rotating', default_location: null,
    lender_flag: 'stephanie',
    notes: 'Venue TBD per month. Step 7 monthly confirm flow resolves location_override on the spawned occurrence.',
  },
  {
    name: 'Class Day',
    owner_contact_id: christineId,
    week_of_month: 4, day_of_week: 4,
    start_time: '09:00', end_time: '12:00',
    location_type: 'fixed', default_location: 'Gainey Office',
    lender_flag: 'christine',
    notes: 'Both Social Media and AI tracks, run in sequence (same pattern as Stephanie Class Day).\n[PLACEHOLDER: specific track items pending from Alex]',
  },
];

const { data: inserted, error: seedErr } = await admin.from('event_templates').insert(rows).select('id, name, week_of_month, day_of_week');
if (seedErr) fail(`seed insert: ${seedErr.message}`);
ok(`inserted ${inserted.length} rows`);

// ---------- 5. VERIFY (mirror of archived SQL verify queries) ----------
console.log('\n[5] VERIFY queries ...');

// 1. count = 9
{
  const { count, error } = await admin.from('event_templates').select('*', { count: 'exact', head: true });
  if (error) fail(`verify count: ${error.message}`);
  if (count !== 9) fail(`row count = ${count}, expected 9`);
  ok(`row count = 9`);
}

// 2. Roster readout
{
  const { data, error } = await admin
    .from('event_templates')
    .select('week_of_month, day_of_week, name, start_time, end_time, location_type, default_location, lender_flag, notes, owner_contact_id')
    .order('week_of_month').order('day_of_week').order('start_time');
  if (error) fail(`verify roster: ${error.message}`);
  const ownerName = { [alexId]: 'Alex Hollien', [christineId]: 'Christine McConnell', [stephanieId]: 'Stephanie Reid' };
  console.log('\nRoster (w/dow/name/owner/starts-ends/type/default_loc/lender/notes-preview):');
  for (const r of data) {
    console.log(`  W${r.week_of_month} DOW${r.day_of_week}  ${r.name.padEnd(26)}  ${ownerName[r.owner_contact_id].padEnd(20)}  ${r.start_time}-${r.end_time}  ${r.location_type.padEnd(8)}  ${(r.default_location||'(rotating)').padEnd(30)}  ${r.lender_flag.padEnd(9)}  ${(r.notes||'').replace(/\n/g,' ').slice(0,60)}`);
  }
}

// 3. Owner distribution
{
  const { data, error } = await admin.from('event_templates').select('owner_contact_id');
  if (error) fail(`verify owner dist: ${error.message}`);
  const counts = {};
  for (const r of data) counts[r.owner_contact_id] = (counts[r.owner_contact_id] || 0) + 1;
  const expected = { [stephanieId]: 4, [christineId]: 4, [alexId]: 1 };
  for (const [id, exp] of Object.entries(expected)) {
    if (counts[id] !== exp) fail(`owner ${id}: got ${counts[id]||0}, expected ${exp}`);
  }
  ok('owner dist: Stephanie=4, Christine=4, Alex=1');
}

// 4. Rotating vs fixed (Step 7 scope)
{
  const { data, error } = await admin.from('event_templates').select('location_type');
  if (error) fail(`verify loc type: ${error.message}`);
  const counts = {};
  for (const r of data) counts[r.location_type] = (counts[r.location_type] || 0) + 1;
  if (counts.fixed !== 4 || counts.rotating !== 5) fail(`loc type split: fixed=${counts.fixed}, rotating=${counts.rotating}, expected 4/5`);
  ok('loc types: fixed=4, rotating=5 (matches Step 7 scope of 5 rotating)');
}

// 5. Lender flag distribution
{
  const { data, error } = await admin.from('event_templates').select('lender_flag');
  if (error) fail(`verify lender flag: ${error.message}`);
  const counts = {};
  for (const r of data) counts[r.lender_flag] = (counts[r.lender_flag] || 0) + 1;
  if (counts.christine !== 4 || counts.stephanie !== 4 || counts.none !== 1)
    fail(`lender flags: christine=${counts.christine}, stephanie=${counts.stephanie}, none=${counts.none}, expected 4/4/1`);
  ok('lender flags: christine=4, stephanie=4, none=1');
}

// 6. Constraint sanity (no fixed without default_location)
{
  const { data, error } = await admin.from('event_templates')
    .select('name, location_type, default_location')
    .eq('location_type', 'fixed').is('default_location', null);
  if (error) fail(`verify fixed-loc constraint: ${error.message}`);
  if (data.length !== 0) fail(`${data.length} fixed rows are missing default_location`);
  ok('constraint sanity: zero fixed rows without default_location');
}

// 7. Placeholder preserved
{
  const { data, error } = await admin.from('event_templates')
    .select('name, week_of_month, day_of_week')
    .like('notes', '%[PLACEHOLDER%');
  if (error) fail(`verify placeholder: ${error.message}`);
  if (data.length !== 1) fail(`expected 1 row with [PLACEHOLDER, got ${data.length}`);
  const r = data[0];
  if (!(r.name === 'Class Day' && r.week_of_month === 4 && r.day_of_week === 4))
    fail(`placeholder row wrong: ${JSON.stringify(r)}`);
  ok('placeholder preserved on Class Day W4 DOW4 (Christine)');
}

console.log('\n✅ Step 4 GREEN. event_templates count = 9.');
