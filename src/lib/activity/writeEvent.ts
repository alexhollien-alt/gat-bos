// src/lib/activity/writeEvent.ts
// Fire-and-forget helper for writing to the activity_events ledger.
// Uses service-role adminClient -- bypasses RLS.
// Safe for Server Actions and API routes. Never call from browser components.
// Never throws. On error, logs via logError and returns void.
// Slice 1 -- 2026-04-22.
// Slice 7A -- 2026-04-30: hard-break. userId is now a required input.
// No env fallback. Callers must source userId from tenantFromRequest,
// row data, or an explicit handler argument.

import { adminClient } from '@/lib/supabase/admin';
import { logError } from '@/lib/error-log';
import type { ActivityVerb } from './types';

interface WriteEventInput {
  userId: string;
  actorId: string;
  verb: ActivityVerb;
  object: { table: string; id: string };
  context?: Record<string, unknown>;
}

export async function writeEvent(input: WriteEventInput): Promise<void> {
  const { userId, actorId, verb, object, context = {} } = input;
  const { error } = await adminClient
    .from('activity_events')
    .insert({
      user_id: userId,
      actor_id: actorId,
      verb,
      object_table: object.table,
      object_id: object.id,
      context,
    });

  if (error) {
    await logError('activity/writeEvent', error.message, {
      verb,
      object_table: object.table,
      object_id: object.id,
    });
  }
}
