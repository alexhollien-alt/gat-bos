#!/usr/bin/env node
/**
 * GAT Event Cycle Step 4 diagnostic.
 * Checks public.contacts for any row matching Alex Hollien.
 * Read-only. Writes nothing.
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
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

console.log('== Check 1: exact first_name=Alex AND last_name=Hollien (active) ==');
const exact = await admin
  .from('contacts')
  .select('id, first_name, last_name, email, type, tier, stage, deleted_at, user_id, created_at')
  .eq('first_name', 'Alex')
  .eq('last_name', 'Hollien')
  .is('deleted_at', null);
console.log(exact.error ? { error: exact.error } : exact.data);

console.log('\n== Check 2: any row (including soft-deleted) matching first_name=Alex ==');
const allAlex = await admin
  .from('contacts')
  .select('id, first_name, last_name, email, type, deleted_at, created_at')
  .ilike('first_name', 'alex');
console.log(allAlex.error ? { error: allAlex.error } : allAlex.data);

console.log('\n== Check 3: any row matching last_name ilike %hollien% ==');
const hollien = await admin
  .from('contacts')
  .select('id, first_name, last_name, email, type, deleted_at, created_at')
  .ilike('last_name', '%hollien%');
console.log(hollien.error ? { error: hollien.error } : hollien.data);

console.log('\n== Check 4: email match alex@alexhollienco.com (any state) ==');
const byEmail = await admin
  .from('contacts')
  .select('id, first_name, last_name, email, type, deleted_at, user_id, created_at')
  .eq('email', 'alex@alexhollienco.com');
console.log(byEmail.error ? { error: byEmail.error } : byEmail.data);

console.log('\n== Check 5: Christine McConnell + Stephanie Reid confirmation (active) ==');
const christine = await admin
  .from('contacts')
  .select('id, first_name, last_name, email, deleted_at')
  .eq('first_name', 'Christine')
  .eq('last_name', 'McConnell')
  .is('deleted_at', null);
console.log('christine:', christine.data);
const stephanie = await admin
  .from('contacts')
  .select('id, first_name, last_name, email, deleted_at')
  .eq('first_name', 'Stephanie')
  .eq('last_name', 'Reid')
  .is('deleted_at', null);
console.log('stephanie:', stephanie.data);

console.log('\n== Check 6: event_templates current row count ==');
const ec = await admin.from('event_templates').select('*', { count: 'exact', head: true });
console.log(ec.error ? { error: ec.error } : { count: ec.count });

console.log('\n== Check 7: contacts columns (sample row shape) ==');
const sample = await admin.from('contacts').select('*').limit(1);
if (sample.data && sample.data[0]) {
  console.log('columns:', Object.keys(sample.data[0]));
}
