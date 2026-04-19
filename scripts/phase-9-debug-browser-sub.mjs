import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { ensureAuthState, loadEnv } from './phase-9-auth-helper.mjs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const STATE = resolve(tmpdir(), 'phase-9-auth-state.json');
const { URL, SERVICE, SITE } = loadEnv();
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

await ensureAuthState(STATE);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: STATE });
const page = await context.newPage();

page.on('console', (msg) => {
  const t = msg.text();
  if (/realtime|subscribe|channel|postgres_changes|SUBSCRIBED|CHANNEL_ERROR|TIMED_OUT|auth/i.test(t)) {
    console.log(`[browser] ${msg.type()}: ${t.slice(0, 200)}`);
  }
});

await page.goto(`${SITE}/today`, { waitUntil: 'networkidle' });

// Give component-level subscription time to attempt
await page.waitForTimeout(2000);

// Now run an IN-PAGE test: create our own channel with explicit status callback
const result = await page.evaluate(async () => {
  const mod = await import('https://esm.sh/@supabase/ssr@0.9');
  const url = document.querySelector('meta[name="x-sup-url"]')?.content;
  // Fall back: pull from window if exposed, else read public env from body data-attr
  // We can't reach process.env in the browser, so inject manually
  return { needsEnv: true };
});

// Do it with explicit URL + anon from env
const { data: { session }, error: sErr } = await admin.auth.admin.listUsers({ perPage: 1 });
// We need alex's session token
const { data: alexUsers } = await admin.auth.admin.listUsers({ perPage: 200 });
const alex = alexUsers.users.find((u) => u.email === 'alex@alexhollienco.com');

// Read env from crm/.env.local via the helper
const env = loadEnv();

const statuses = [];
const events = [];

// Inject a probe that creates its own client from cookies, subscribes to email_drafts, logs status
await page.addScriptTag({
  content: `
    window.__probeReady = (async () => {
      const mod = await import('https://esm.sh/@supabase/ssr@0.9');
      const client = mod.createBrowserClient(${JSON.stringify(env.URL)}, ${JSON.stringify(env.ANON)});
      const { data: { session } } = await client.auth.getSession();
      window.__probeSession = session ? { userEmail: session.user.email, hasToken: !!session.access_token } : null;
      window.__probeStatuses = [];
      window.__probeEvents = [];
      const channel = client.channel('probe_email_drafts_' + Date.now())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'email_drafts' }, (payload) => {
          window.__probeEvents.push({ t: Date.now(), new_id: payload.new?.id, event: payload.eventType });
        })
        .subscribe((status, err) => {
          window.__probeStatuses.push({ t: Date.now(), status, err: err?.message || null });
        });
      window.__probeChannel = channel;
      return 'ready';
    })();
  `,
});

await page.waitForFunction(() => window.__probeReady !== undefined, null, { timeout: 10000 });
await page.evaluate(() => window.__probeReady);

await page.waitForTimeout(3000);

const probeSession = await page.evaluate(() => window.__probeSession);
console.log('[browser] probe session:', JSON.stringify(probeSession));

const statusesSoFar = await page.evaluate(() => window.__probeStatuses);
console.log('[browser] probe subscribe statuses (pre-insert):', JSON.stringify(statusesSoFar));

// Now insert a draft server-side
const { data: emailRow } = await admin.from('emails').insert({
  gmail_id: `phase-9-debug-browser-${Date.now()}`,
  from_email: 'debug@phase9.local',
  from_name: 'Debug',
  subject: 'debug',
  body_plain: 'debug',
  is_unread: true,
  created_at: new Date().toISOString(),
}).select('id').single();

const { data: draftRow } = await admin.from('email_drafts').insert({
  email_id: emailRow.id,
  draft_subject: 'Debug draft probe',
  draft_body_plain: 'debug probe',
  status: 'generated',
  expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
}).select('id').single();

console.log('[server] inserted draft.id=', draftRow.id);

await page.waitForTimeout(5000);

const statusesAfter = await page.evaluate(() => window.__probeStatuses);
const eventsReceived = await page.evaluate(() => window.__probeEvents);
console.log('[browser] probe subscribe statuses (post-insert):', JSON.stringify(statusesAfter));
console.log('[browser] probe events received:', JSON.stringify(eventsReceived));

// Cleanup
await admin.from('email_drafts').update({ status: 'discarded' }).eq('id', draftRow.id);

await browser.close();

if (eventsReceived.length > 0) {
  console.log('PASS: Browser DID receive realtime events when subscribed in-page.');
  process.exit(0);
} else {
  console.log('FAIL: Browser did NOT receive realtime events despite session =', probeSession);
  process.exit(1);
}
