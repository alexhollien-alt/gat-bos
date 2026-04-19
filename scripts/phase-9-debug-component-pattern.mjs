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

await page.goto(`${env.SITE}/today`, { waitUntil: 'networkidle' });

// Wait for card to render so the component's subscription has definitely run
await page.waitForSelector('h2:has-text("Pending drafts")', { timeout: 15000 });
await page.waitForTimeout(2000);

// Attach an observer to the component's channel
const probeResult = await page.evaluate(() => {
  // Find the supabase realtime client on window or via createClient
  const out = { channels: [], sockets: [] };
  // @supabase/supabase-js stores the realtime socket on the client; we cannot reach the
  // component's client from outside React, so count realtime websockets opened on the page.
  return out;
});

// We'll instead rely on network-level inspection of WS frames
// Capture all WS frames from the realtime socket
const wsFrames = [];
page.on('websocket', (ws) => {
  if (ws.url().includes('realtime')) {
    ws.on('framesent', (f) => wsFrames.push({ dir: 'out', t: Date.now(), payload: typeof f.payload === 'string' ? f.payload.slice(0, 300) : '[binary]' }));
    ws.on('framereceived', (f) => wsFrames.push({ dir: 'in', t: Date.now(), payload: typeof f.payload === 'string' ? f.payload.slice(0, 300) : '[binary]' }));
  }
});

// Already past the component's subscription time. Let's force a navigation to re-trigger.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('h2:has-text("Pending drafts")', { timeout: 15000 });
await page.waitForTimeout(3000);

console.log(`[ws] captured ${wsFrames.length} frames during reload`);
const phxMessages = wsFrames.filter((f) => /phx_join|postgres_changes|system|access_token/.test(f.payload));
console.log(`[ws] ${phxMessages.length} auth/join/channel-related frames:`);
phxMessages.slice(0, 20).forEach((f) => console.log(`  [${f.dir}] ${f.payload.slice(0, 250)}`));

// Now trigger server-side insert
const { data: emailRow } = await admin.from('emails').insert({
  gmail_id: `phase-9-cp-${Date.now()}`,
  from_email: 'cp@phase9.local',
  from_name: 'CP',
  subject: 'cp',
  body_plain: 'cp',
  is_unread: true,
  created_at: new Date().toISOString(),
}).select('id').single();

const { data: draftRow } = await admin.from('email_drafts').insert({
  email_id: emailRow.id,
  draft_subject: 'Component-pattern probe',
  draft_body_plain: 'cp probe',
  status: 'generated',
  expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
}).select('id').single();
console.log('[server] inserted draft.id=', draftRow.id);

await page.waitForTimeout(6000);

// Did the card show it?
const liCount = await page.evaluate(() => {
  const h2s = Array.from(document.querySelectorAll('h2'));
  const h2 = h2s.find((n) => n.textContent?.trim() === 'Pending drafts');
  if (!h2) return -1;
  let node = h2, section = null;
  while (node && node !== document.body) {
    if (node.tagName === 'SECTION') { section = node; break; }
    node = node.parentElement;
  }
  if (!section) return -1;
  return section.querySelectorAll('ul > li').length;
});
console.log('[browser] drafts rendered in card (post-insert):', liCount);

const postInsertFrames = wsFrames.filter((f) => f.t >= Date.now() - 7000);
const postgresChangeFrames = postInsertFrames.filter((f) => /postgres_changes|new.*cd3c|Component-pattern/.test(f.payload));
console.log(`[ws] post-insert frames mentioning postgres_changes: ${postgresChangeFrames.length}`);
postgresChangeFrames.slice(0, 5).forEach((f) => console.log(`  [${f.dir}] ${f.payload.slice(0, 400)}`));

// Cleanup
await admin.from('email_drafts').update({ status: 'discarded' }).eq('id', draftRow.id);

await browser.close();

process.exit(0);
