import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './phase-9-auth-helper.mjs';

const { URL, SERVICE } = loadEnv();
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const { data, error } = await admin.rpc('exec_sql', {
  sql: `SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;`,
}).catch((e) => ({ error: e }));

if (error) {
  console.log('RPC exec_sql not available; falling back to direct query attempt');
  // Try another method: subscribe + provoke
  console.log('Cannot inspect pg_publication_tables without privileged RPC. Skip.');
} else {
  console.log(data);
}
process.exit(0);
