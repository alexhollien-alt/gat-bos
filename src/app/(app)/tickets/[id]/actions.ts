'use server';

// src/app/(app)/tickets/[id]/actions.ts
// Server Action for ticket status mutation + activity ledger write.
// Replaces the direct supabase.update() call in the client page.
// Slice 1 -- 2026-04-22.
// Slice 7A -- 2026-04-30: writeEvent userId/actorId now row-derived
// (tickets.user_id), no OWNER_USER_ID env dependency.

import { adminClient } from '@/lib/supabase/admin';
import { writeEvent } from '@/lib/activity/writeEvent';
import type { MaterialRequestStatus } from '@/lib/types';

export async function updateTicketNotes(
  ticketId: string,
  notes: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: ticketRow } = await adminClient
    .from('tickets')
    .select('user_id, contact_id')
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticketRow?.user_id) {
    return { ok: false, error: 'ticket not found' };
  }

  const { error } = await adminClient
    .from('tickets')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  if (error) {
    return { ok: false, error: error.message };
  }

  void writeEvent({
    userId: ticketRow.user_id,
    actorId: ticketRow.user_id,
    verb: 'ticket.notes_updated',
    object: { table: 'tickets', id: ticketId },
    context: {
      ...(ticketRow.contact_id ? { contact_id: ticketRow.contact_id } : {}),
    },
  });

  return { ok: true };
}

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

  // Fetch user_id (for writeEvent) + contact_id so this event appears in
  // the per-contact timeline. getContactTimeline filters by object_id OR
  // context->>'contact_id'.
  const { data: ticketRow } = await adminClient
    .from('tickets')
    .select('user_id, contact_id')
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticketRow?.user_id) {
    return { ok: false, error: 'ticket not found' };
  }

  const { error } = await adminClient
    .from('tickets')
    .update(updates)
    .eq('id', ticketId);

  if (error) {
    return { ok: false, error: error.message };
  }

  void writeEvent({
    userId: ticketRow.user_id,
    actorId: ticketRow.user_id,
    verb: 'ticket.status_changed',
    object: { table: 'tickets', id: ticketId },
    context: {
      from_status: fromStatus,
      to_status: toStatus,
      // contact_id enables getContactTimeline to surface this event per contact.
      ...(ticketRow.contact_id ? { contact_id: ticketRow.contact_id } : {}),
    },
  });

  return { ok: true };
}
