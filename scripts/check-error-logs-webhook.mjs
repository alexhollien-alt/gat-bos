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
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const { data, error } = await admin
  .from('error_logs')
  .select('*')
  .ilike('endpoint', '%webhooks/resend%')
  .gte('created_at', since)
  .order('created_at', { ascending: false })
  .limit(20);

console.log(JSON.stringify({ error, count: data?.length ?? 0, rows: data }, null, 2));
