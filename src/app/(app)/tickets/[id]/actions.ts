'use server';

// src/app/(app)/tickets/[id]/actions.ts
// Server Action for ticket status mutation + activity ledger write.
// Replaces the direct supabase.update() call in the client page.
// Slice 1 -- 2026-04-22.

import { adminClient } from '@/lib/supabase/admin';
import { writeEvent } from '@/lib/activity/writeEvent';
import type { MaterialRequestStatus } from '@/lib/types';

const OWNER_USER_ID = process.env.OWNER_USER_ID ?? '';

export async function updateTicketStatus(
  ticketId: string,
  fromStatus: MaterialRequestStatus,
  toStatus: MaterialRequestStatus,
): Promise<{ ok: boolean; error?: string }> {
  const updates: Record<string, unknown> = {
    status: toStatus,
    updated_at: new Date().toISOString(),
  };
  if (toStatus === 'submitted') updates.submitted_at = new Date().toISOString();
  if (toStatus === 'complete') updates.completed_at = new Date().toISOString();

  // Fetch contact_id so this event appears in the per-contact timeline.
  // getContactTimeline filters by object_id OR context->>'contact_id'.
  const { data: ticketRow } = await adminClient
    .from('material_requests')
    .select('contact_id')
    .eq('id', ticketId)
    .maybeSingle();

  const { error } = await adminClient
    .from('material_requests')
    .update(updates)
    .eq('id', ticketId);

  if (error) {
    return { ok: false, error: error.message };
  }

  void writeEvent({
    actorId: OWNER_USER_ID,
    verb: 'ticket.status_changed',
    object: { table: 'material_requests', id: ticketId },
    context: {
      from_status: fromStatus,
      to_status: toStatus,
      // contact_id enables getContactTimeline to surface this event per contact.
      ...(ticketRow?.contact_id ? { contact_id: ticketRow.contact_id } : {}),
    },
  });

  return { ok: true };
}
