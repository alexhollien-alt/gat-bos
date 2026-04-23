// src/lib/activity/writeEvent.ts
// Fire-and-forget helper for writing to the activity_events ledger.
// Uses service-role adminClient -- bypasses RLS.
// Safe for Server Actions and API routes. Never call from browser components.
// Never throws. On error, logs via logError and returns void.
// Slice 1 -- 2026-04-22.

import { adminClient } from '@/lib/supabase/admin';
import { logError } from '@/lib/error-log';
import type { ActivityVerb } from './types';

const OWNER_USER_ID = process.env.OWNER_USER_ID ?? '';

interface WriteEventInput {
  actorId: string;
  verb: ActivityVerb;
  object: { table: string; id: string };
  context?: Record<string, unknown>;
}

export async function writeEvent(input: WriteEventInput): Promise<void> {
  const { actorId, verb, object, context = {} } = input;
  const { error } = await adminClient
    .from('activity_events')
    .insert({
      user_id: OWNER_USER_ID,
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
