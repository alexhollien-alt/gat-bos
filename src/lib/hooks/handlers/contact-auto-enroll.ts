// Slice 5B Task 6 -- contact-created auto-enrollment handler.
//
// Thin adapter around autoEnrollNewAgent so the dispatcher can run it as
// an isolated handler. Failures here surface as activity_events
// 'hook.failed' on the contact row but never block the welcome-task
// handler that runs in parallel.

import { adminClient } from '@/lib/supabase/admin';
import { autoEnrollNewAgent } from '@/lib/campaigns/actions';
import type { FirePostCreationHooksInput } from '../post-creation';

export async function autoEnrollNewAgentHandler(
  input: FirePostCreationHooksInput,
): Promise<void> {
  const { entityId: contactId, ownerUserId } = input;
  await autoEnrollNewAgent(adminClient, contactId, ownerUserId);
}
