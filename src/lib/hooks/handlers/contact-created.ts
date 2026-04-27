// Slice 5B Task 6 -- contact-created welcome-task handler.
//
// Writes a single follow-up task three days after contact creation. Idempotent
// on (contact_id, source='contact_hook') so re-firing the dispatcher (retry,
// double-tap, cron rerun) does not produce duplicate welcome tasks.

import { adminClient } from '@/lib/supabase/admin';
import { writeEvent } from '@/lib/activity/writeEvent';
import { logError } from '@/lib/error-log';
import type { FirePostCreationHooksInput } from '../post-creation';

const HOOK_SOURCE = 'contact_hook';
const ROUTE = 'hooks/contact-created';
const DAY_MS = 24 * 60 * 60 * 1000;

interface ContactRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  type: string | null;
  deleted_at: string | null;
}

export async function contactWelcomeTaskHandler(
  input: FirePostCreationHooksInput,
): Promise<void> {
  const { entityId: contactId, ownerUserId } = input;

  // Idempotency: skip if a welcome task already exists for this contact.
  const { data: existing } = await adminClient
    .from('tasks')
    .select('id')
    .eq('contact_id', contactId)
    .eq('source', HOOK_SOURCE)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    return;
  }

  const { data: contact, error: contactErr } = await adminClient
    .from('contacts')
    .select('id, first_name, last_name, full_name, type, deleted_at')
    .eq('id', contactId)
    .maybeSingle<ContactRow>();
  if (contactErr || !contact) {
    await logError(ROUTE, 'contact lookup failed or row missing', {
      contactId,
      error: contactErr?.message,
    });
    return;
  }
  if (contact.deleted_at) {
    return;
  }

  const firstName =
    contact.first_name?.trim() ||
    contact.full_name?.trim().split(/\s+/)[0] ||
    'this contact';

  const dueAt = new Date(Date.now() + 3 * DAY_MS).toISOString();

  const { error: taskErr } = await adminClient.from('tasks').insert({
    title: `Schedule discovery call with ${firstName}`,
    description: null,
    due_date: dueAt,
    priority: 'medium',
    status: 'open',
    type: 'follow_up',
    source: HOOK_SOURCE,
    action_hint: 'Use /agent-creative-brief skill flow when scheduled.',
    user_id: ownerUserId,
    contact_id: contact.id,
  });
  if (taskErr) {
    await logError(ROUTE, `welcome task insert failed: ${taskErr.message}`, { contactId });
    throw new Error(`welcome task insert failed: ${taskErr.message}`);
  }

  await writeEvent({
    actorId: ownerUserId,
    verb: 'contact.hook_fired',
    object: { table: 'contacts', id: contact.id },
    context: {
      handler: 'contact-welcome-task',
      contact_type: contact.type,
    },
  });
}
