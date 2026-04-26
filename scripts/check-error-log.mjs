import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(resolve(homedir(), 'crm', '.env.local'), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Probe: does interactions view exist? does morning_briefs exist?
const probes = [
  await sb.from('interactions').select('contact_id', { count: 'exact', head: true }),
  await sb.from('morning_briefs').select('id', { count: 'exact', head: true }),
  await sb.from('contacts').select('id, tier', { count: 'exact', head: true }).in('tier', ['A','B','C']).is('deleted_at', null),
  await sb.from('opportunities').select('contact_id, stage', { count: 'exact', head: true }).in('stage', ['under_contract','in_escrow']).is('deleted_at', null),
];
for (const p of probes) {
  console.log(JSON.stringify({ count: p.count, error: p.error }, null, 2));
}
