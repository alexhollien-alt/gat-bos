import { ensureAuthState, loadEnv } from './phase-9-auth-helper.mjs';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const STATE = '/tmp/morning-auth-state.json';
const { URL, SERVICE, SITE } = loadEnv();
await ensureAuthState(STATE);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: STATE });
const page = await ctx.newPage();
await page.goto(`${SITE}/login`, { waitUntil: 'domcontentloaded' });

const apiResp = await page.evaluate(async () => {
  const r = await fetch('/api/morning/latest', { credentials: 'include' });
  return { status: r.status, body: await r.text() };
});
await browser.close();

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const { data: rows, error: rowsErr } = await admin
  .from('morning_briefs')
  .select('id, brief_date, generated_at, model, contacts_scored, deleted_at')
  .order('generated_at', { ascending: false })
  .limit(5);

console.log(JSON.stringify({
  api: apiResp,
  table_query_error: rowsErr?.message ?? null,
  row_count: rows?.length ?? null,
  rows,
}, null, 2));
