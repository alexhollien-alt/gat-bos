// src/lib/activity/types.ts
// Canonical type contracts for the activity_events ledger.
// Slice 1 -- 2026-04-22.

export type ActivityVerb =
  | 'capture.created'
  | 'capture.transcribed'
  | 'capture.classified'
  | 'capture.promoted'
  | 'capture.promoted.task'
  | 'capture.promoted.ticket'
  | 'capture.promoted.contact'
  | 'capture.promoted.touchpoint'
  | 'capture.promoted.event'
  | 'ticket.status_changed'
  | 'email.sent'
  | 'message.sent'
  | 'message.drafted'
  | 'project.updated'
  | 'event.created'
  | 'campaign.step_fired'
  | 'campaign.step_skipped'
  | 'campaign.send_failed'
  | 'campaign.completed'
  | 'ai.call'
  | 'interaction.call'
  | 'interaction.text'
  | 'interaction.email'
  | 'interaction.meeting'
  | 'interaction.broker_open'
  | 'interaction.lunch'
  | 'interaction.note'
  | 'interaction.email_sent'
  | 'interaction.email_received'
  | 'interaction.event'
  | 'interaction.backfilled'
  | 'ticket.notes_updated'
  | 'hook.failed'
  | 'event.contact_only';

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
