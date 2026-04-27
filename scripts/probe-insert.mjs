import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
const env = Object.fromEntries(
  readFileSync(resolve(homedir(), 'crm', '.env.local'), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; })
);
// Hit OpenAPI root to list known tables
const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
});
const j = await r.json();
const defs = Object.keys(j.definitions || {}).sort();
console.log('table count:', defs.length);
console.log('contains morning_briefs:', defs.includes('morning_briefs'));
console.log('m-prefixed tables:', defs.filter(d=>d.startsWith('m')));
