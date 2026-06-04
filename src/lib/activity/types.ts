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
  | 'ai.budget_blocked'
  | 'ai.budget_warning'
  | 'ai.budget_default_used'
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
  | 'ticket.created'
  | 'ticket.field_updated'
  | 'ticket.deleted'
  | 'ticket.synced'
  | 'ticket.cypher_id_assigned'
  | 'hook.failed'
  | 'event.contact_only'
  | 'project.hook_fired'
  | 'contact.hook_fired'
  | 'event.hook_fired'
  | 'weekly_snapshot.pulled'
  | 'weekly_snapshot.pull_failed'
  | 'campaign.draft_created'
  | 'campaign.draft_approved'
  | 'campaign.draft_rejected'
  | 'campaign.draft_edited'
  | 'campaign.sent'
  | 'campaign.send_skipped_unapproved'
  | 'event.invite.queued'
  | 'event.invite.test_sent'
  | 'event.invite.sent'
  | 'event.invite.send_failed'
  | 'event.rsvp.received'
  | 'open_house.blast.created'
  | 'open_house.blast.previewed'
  | 'open_house.blast.sent'
  | 'open_house.blast.send_failed'
  | 'open_house.email.delivered'
  | 'open_house.email.opened'
  | 'open_house.email.clicked'
  | 'open_house.email.bounced'
  | 'open_house.email.complained'
  | 'open_house.unsubscribed'
  | 'deliverable.shipped'
  | 'deliverable.briefed'
  | 'transaction.opened'
  | 'transaction.under_contract'
  | 'transaction.in_escrow'
  | 'transaction.closed'
  | 'transaction.fell_through'
  | 'brief_sent';

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
