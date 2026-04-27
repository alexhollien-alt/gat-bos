// Slice 5B Task 5 -- event-created handler.
//
// Wired into both /api/calendar/create (dashboard outbound) and
// /api/calendar/sync-in (Google -> dashboard pull) per row upserted.
//
// Behavior:
//   project_id non-null -> insert project_touchpoints(touchpoint_type='event'),
//                          idempotent on (entity_table='events', entity_id).
//   project_id null + contact_id non-null -> activity_events(verb='event.contact_only').
//   neither -> no-op (and no hook.fired marker; bare events without context
//              don't justify the side effect).

import { adminClient } from '@/lib/supabase/admin';
import { writeEvent } from '@/lib/activity/writeEvent';
import { logError } from '@/lib/error-log';
import type { FirePostCreationHooksInput } from '../post-creation';

const ROUTE = 'hooks/event-created';

interface EventRow {
  id: string;
  title: string | null;
  start_at: string | null;
  project_id: string | null;
  contact_id: string | null;
  deleted_at: string | null;
}

export async function eventCreatedHandler(
  input: FirePostCreationHooksInput,
): Promise<void> {
  const { entityId: eventId, ownerUserId } = input;

  const { data: event, error: eventErr } = await adminClient
    .from('events')
    .select('id, title, start_at, project_id, contact_id, deleted_at')
    .eq('id', eventId)
    .maybeSingle<EventRow>();
  if (eventErr || !event) {
    await logError(ROUTE, 'event lookup failed or row missing', {
      eventId,
      error: eventErr?.message,
    });
    return;
  }
  if (event.deleted_at) {
    return;
  }

  if (event.project_id) {
    // Idempotency on (entity_table, entity_id) for this project.
    const { data: existing } = await adminClient
      .from('project_touchpoints')
      .select('id')
      .eq('entity_table', 'events')
      .eq('entity_id', event.id)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      return;
    }

    const { error: tpErr } = await adminClient.from('project_touchpoints').insert({
      project_id: event.project_id,
      touchpoint_type: 'event',
      entity_table: 'events',
      entity_id: event.id,
      occurred_at: event.start_at,
      due_at: event.start_at,
      note: event.title ?? null,
      user_id: ownerUserId,
    });
    if (tpErr) {
      await logError(ROUTE, `touchpoint insert failed: ${tpErr.message}`, { eventId });
      throw new Error(`touchpoint insert failed: ${tpErr.message}`);
    }

    await writeEvent({
      actorId: ownerUserId,
      verb: 'event.hook_fired',
      object: { table: 'events', id: event.id },
      context: { handler: 'event-created', branch: 'project_link', project_id: event.project_id },
    });
    return;
  }

  if (event.contact_id) {
    // Idempotency: don't double-write event.contact_only for the same event.
    const { data: existing } = await adminClient
      .from('activity_events')
      .select('id')
      .eq('object_table', 'events')
      .eq('object_id', event.id)
      .eq('verb', 'event.contact_only')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      return;
    }
    await writeEvent({
      actorId: ownerUserId,
      verb: 'event.contact_only',
      object: { table: 'events', id: event.id },
      context: {
        handler: 'event-created',
        branch: 'contact_only',
        contact_id: event.contact_id,
        title: event.title,
        start_at: event.start_at,
      },
    });
  }
}
