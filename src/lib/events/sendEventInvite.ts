// 2026-05-04 -- Thin wrapper over sendMessage() for event invite sends.
//
// Resolves the 'event-invite' template, dispatches via Resend, then:
//   1. Updates the event_invites row with status + sent_at + message_log_id
//   2. Writes an activity_events ledger entry
//
// Variables map (must all be strings per Handlebars-lite renderer contract):
//   test_prefix       -- "" or "[TEST] "
//   first_name        -- contact.first_name
//   event_name, event_date, event_time, event_address
//   slots_remaining, slots_total -- digit strings
//   hero_image_url    -- public flyer URL
//   rsvp_instruction  -- closing CTA copy
//
// Errors from sendMessage rethrow; this wrapper catches them, marks the
// event_invite as 'failed', writes a `event.invite.send_failed` activity
// event, then rethrows so the caller can decide whether to halt the loop.

import { sendMessage } from "@/lib/messaging/send";
import { adminClient } from "@/lib/supabase/admin";
import { writeEvent } from "@/lib/activity/writeEvent";

export interface EventInviteVariables {
  event_name: string;
  event_date: string;
  event_time: string;
  event_address: string;
  slots_remaining: number;
  slots_total: number;
  hero_image_url: string;
  rsvp_instruction: string;
}

export interface SendEventInviteArgs {
  inviteId: string;
  toEmail: string;
  toFirstName: string;
  userId: string;
  isTest?: boolean;
  variables: EventInviteVariables;
}

export interface SendEventInviteResult {
  ok: true;
  inviteId: string;
  messageLogId: string;
  providerMessageId: string;
  status: "test_sent" | "sent";
  sentAt: string;
}

export async function sendEventInvite(
  args: SendEventInviteArgs,
): Promise<SendEventInviteResult> {
  const variables: Record<string, string> = {
    test_prefix: args.isTest ? "[TEST] " : "",
    first_name: args.toFirstName,
    event_name: args.variables.event_name,
    event_date: args.variables.event_date,
    event_time: args.variables.event_time,
    event_address: args.variables.event_address,
    slots_remaining: String(args.variables.slots_remaining),
    slots_total: String(args.variables.slots_total),
    hero_image_url: args.variables.hero_image_url,
    rsvp_instruction: args.variables.rsvp_instruction,
  };

  let result;
  try {
    result = await sendMessage({
      templateSlug: "event-invite",
      recipient: args.toEmail,
      userId: args.userId,
      mode: "resend",
      variables,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await adminClient
      .from("event_invites")
      .update({ status: "failed", bounce_reason: message })
      .eq("id", args.inviteId);
    await writeEvent({
      userId: args.userId,
      actorId: args.userId,
      verb: "event.invite.send_failed",
      object: { table: "event_invites", id: args.inviteId },
      context: { to_email: args.toEmail, error: message, is_test: !!args.isTest },
    });
    throw err;
  }

  const newStatus: "test_sent" | "sent" = args.isTest ? "test_sent" : "sent";
  await adminClient
    .from("event_invites")
    .update({
      status: newStatus,
      sent_at: result.sentAt,
      message_log_id: result.logId,
    })
    .eq("id", args.inviteId);

  await writeEvent({
    userId: args.userId,
    actorId: args.userId,
    verb: args.isTest ? "event.invite.test_sent" : "event.invite.sent",
    object: { table: "event_invites", id: args.inviteId },
    context: {
      to_email: args.toEmail,
      message_log_id: result.logId,
      provider_message_id: result.providerMessageId,
      send_mode: result.sendMode,
    },
  });

  return {
    ok: true,
    inviteId: args.inviteId,
    messageLogId: result.logId,
    providerMessageId: result.providerMessageId,
    status: newStatus,
    sentAt: result.sentAt,
  };
}
