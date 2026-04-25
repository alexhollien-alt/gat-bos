import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const env = readFileSync(resolve(process.env.HOME, 'crm/.env.local'),'utf8');
const get = (k) => env.split('\n').find(l=>l.startsWith(k+'='))?.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));
// reload schema cache
const { error } = await sb.rpc('pgrst_reload', {}).catch(e=>({error:e}));
console.log('pgrst_reload rpc:', error || 'ok');
// fall back to NOTIFY via raw SQL on system_admin endpoint? PostgREST notify is only via NOTIFY pgrst, 'reload schema'
// try direct
const { data, error: e2 } = await sb.from('morning_briefs').select('id').limit(1);
console.log('morning_briefs after reload:', e2 || 'reachable, rows:'+(data?.length??0));
