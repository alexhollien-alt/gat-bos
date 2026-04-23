// src/lib/activity/types.ts
// Canonical type contracts for the activity_events ledger.
// Slice 1 -- 2026-04-22.

export type ActivityVerb =
  | 'capture.created'
  | 'capture.transcribed'
  | 'capture.classified'
  | 'capture.promoted'
  | 'ticket.status_changed'
  | 'email.sent'
  | 'message.sent'
  | 'message.drafted'
  | 'project.updated'
  | 'event.created'
  | 'campaign.step_fired'
  | 'ai.call'
  | 'interaction.backfilled'
  | 'ticket.notes_updated';

export interface ActivityEvent {
  id: string;
  user_id: string;
  actor_id: string;
  verb: ActivityVerb;
  object_table: string;
  object_id: string;
  context: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
  deleted_at: string | null;
}
