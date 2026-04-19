import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'node:path';

config({ path: resolve(process.env.HOME, 'crm/.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

let received = null;
const channel = admin
  .channel('phase-9-pub-check')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'email_drafts' },
    (payload) => {
      received = payload;
      console.log('[pub-check] Received INSERT event:', payload.new?.id);
    },
  )
  .subscribe((status) => console.log('[pub-check] subscribe status:', status));

await new Promise((r) => setTimeout(r, 3000));

const gmailId = `phase-9-pub-check-${Date.now()}`;
const { data: email, error: eErr } = await admin
  .from('emails')
  .insert({
    gmail_id: gmailId,
    from_email: 'pub-check@phase9.local',
    from_name: 'Pub Check',
    subject: 'Pub check',
    body_plain: 'pub check',
    is_unread: true,
    created_at: new Date().toISOString(),
  })
  .select('id')
  .single();
if (eErr) {
  console.error('[pub-check] emails insert failed:', eErr.message);
  process.exit(2);
}

const { data: draft, error: dErr } = await admin
  .from('email_drafts')
  .insert({
    email_id: email.id,
    draft_subject: 'Phase 9 pub-check draft',
    draft_body_plain: 'pub check',
    status: 'generated',
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  })
  .select('id')
  .single();
if (dErr) {
  console.error('[pub-check] email_drafts insert failed:', dErr.message);
  process.exit(2);
}
console.log('[pub-check] Inserted email_drafts.id=', draft.id);

await new Promise((r) => setTimeout(r, 5000));

await admin
  .from('email_drafts')
  .update({ status: 'discarded' })
  .eq('id', draft.id);

await channel.unsubscribe();

if (received) {
  console.log('PASS: Realtime IS broadcasting email_drafts INSERT events.');
  process.exit(0);
} else {
  console.log('FAIL: Realtime did NOT broadcast email_drafts INSERT.');
  console.log('      => publication likely still missing email_drafts.');
  process.exit(1);
}
