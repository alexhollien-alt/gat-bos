#!/usr/bin/env node
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

console.log('== Distinct contact types currently in use ==');
const types = await admin.from('contacts').select('type').not('type', 'is', null);
const unique = [...new Set((types.data || []).map(r => r.type))].sort();
console.log(unique);

console.log('\n== Christine + Stephanie full row (to mirror shape for Alex) ==');
const shape = await admin
  .from('contacts')
  .select('first_name, last_name, email, type, tier, stage, brokerage, title, user_id, palette, font_kit')
  .in('id', ['c254b9b2-6e14-4250-98c4-48eaba421322', '350ef57b-4c09-4952-bf70-87dad5a94d2e']);
console.log(shape.data);

console.log('\n== auth.users: is there a user for alex@alexhollienco.com? ==');
const { data: users, error } = await admin.auth.admin.listUsers();
if (error) { console.error(error); process.exit(1); }
const alexAuth = (users.users || []).filter(u => u.email === 'alex@alexhollienco.com');
console.log(alexAuth.map(u => ({ id: u.id, email: u.email, created_at: u.created_at })));
