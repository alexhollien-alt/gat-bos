import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { ensureAuthState, loadEnv } from './phase-9-auth-helper.mjs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const STATE = resolve(tmpdir(), 'phase-9-auth-state.json');
const env = loadEnv();
const admin = createClient(env.URL, env.SERVICE, { auth: { persistSession: false } });
await ensureAuthState(STATE);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: STATE });
const page = await context.newPage();

const wsFrames = [];
page.on('websocket', (ws) => {
  if (ws.url().includes('realtime')) {
    ws.on('framereceived', (f) => wsFrames.push({ t: Date.now(), p: typeof f.payload === 'string' ? f.payload : '[bin]' }));
  }
});

await page.goto(`${env.SITE}/today`, { waitUntil: 'networkidle' });
await page.waitForSelector('h2:has-text("Pending drafts")', { timeout: 15000 });

// Wait for subscription to confirm
await page.waitForFunction(() => {
  return document.querySelector('h2'); // placeholder
}, null, { timeout: 5000 });
await page.waitForTimeout(3000);

const tSub = Date.now();
console.log(`[t=0] subscriptions settled. Total frames so far: ${wsFrames.length}`);

const { data: emailRow } = await admin.from('emails').insert({
  gmail_id: `phase-9-raw-${Date.now()}`, from_email: 'r@p9.l', from_name: 'R',
  subject: 'r', body_plain: 'r', is_unread: true, created_at: new Date().toISOString(),
}).select('id').single();
const { data: draftRow } = await admin.from('email_drafts').insert({
  email_id: emailRow.id, draft_subject: 'RAW probe', draft_body_plain: 'raw',
  status: 'generated', expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
}).select('id').single();
console.log(`[t=${Date.now() - tSub}ms] inserted draft.id=${draftRow.id}`);

await page.waitForTimeout(6000);

const postInsert = wsFrames.filter((f) => f.t >= tSub);
console.log(`[result] ${postInsert.length} frames received after subscription settled:`);
postInsert.forEach((f, i) => console.log(`  [${i}] +${f.t - tSub}ms: ${f.p.slice(0, 300)}`));

await admin.from('email_drafts').update({ status: 'discarded' }).eq('id', draftRow.id);
await browser.close();
