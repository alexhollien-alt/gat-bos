// src/app/api/cron/campaign-runner/route.ts
//
// Slice 5A Task 3 -- drip-campaign tick. Every 15 minutes Vercel cron fires
// here. Pulls up to 50 active enrollments whose next_action_at <= now() and
// for each one looks up the next campaign_step (step_number = current_step + 1),
// resolves its template_slug, calls sendMessage(), advances current_step,
// schedules next_action_at, and writes a campaign_step_completions row.
//
// Scheduling semantics (Task 5 fix):
//   step.delay_days is an ABSOLUTE offset from enrollment.enrolled_at. So
//   step 1 with delay_days=0 fires at enrolled_at, step 2 with delay_days=3
//   fires at enrolled_at+3 days, etc. After firing step N, the runner looks
//   up step N+1 and schedules next_action_at = enrolled_at + step_{N+1}.delay_days.
//   If no step N+1 exists, the enrollment is marked completed on the next
//   tick (the standard step-missing path below).
//
// Failure semantics (Slice 5A scope):
//   - sendMessage throws  -> activity_events 'campaign.send_failed';
//                            current_step + next_action_at unchanged so the
//                            next tick retries (no exponential backoff yet --
//                            tracked in LATER for Slice 5B).
//   - step row missing    -> enrollment status='completed', completed_at=now(),
//                            activity_events 'campaign.completed'.
//   - template_slug NULL  -> step is treated as a no-op skip;
//                            activity_events 'campaign.step_skipped',
//                            current_step still advances + next-step lookup
//                            still schedules next_action_at so the campaign
//                            keeps cadence.
//
// Auth: Bearer CRON_SECRET (Vercel cron header) per /api/cron/morning-brief.
// Runtime: Node (service-role client, no edge restrictions).

import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/api-auth";
import { logError } from "@/lib/error-log";
import { writeEvent } from "@/lib/activity/writeEvent";
import { sendMessage } from "@/lib/messaging/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE = "/api/cron/campaign-runner";
const TICK_LIMIT = 50;
const ACTOR = "system:campaign-runner";

interface EnrollmentRow {
  id: string;
  campaign_id: string;
  contact_id: string;
  current_step: number;
  user_id: string;
  enrolled_at: string;
}

interface CampaignStepRow {
  id: string;
  step_number: number;
  delay_days: number;
  template_slug: string | null;
}

interface ContactRow {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  deleted_at: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function fromEnrollmentIso(enrolledAt: string, days: number): string {
  return new Date(new Date(enrolledAt).getTime() + days * 86_400_000).toISOString();
}

async function lookupNextStepDelay(
  campaignId: string,
  nextStepNumber: number,
): Promise<number | null> {
  const { data, error } = await adminClient
    .from("campaign_steps")
    .select("delay_days")
    .eq("campaign_id", campaignId)
    .eq("step_number", nextStepNumber)
    .is("deleted_at", null)
    .maybeSingle<{ delay_days: number }>();
  if (error) throw new Error(`next-step lookup failed: ${error.message}`);
  return data?.delay_days ?? null;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const result = { ok: true, processed: 0, sent: 0, failed: 0, skipped: 0, completed: 0 };

  const { data: due, error: dueErr } = await adminClient
    .from("campaign_enrollments")
    .select("id, campaign_id, contact_id, current_step, user_id, enrolled_at")
    .eq("status", "active")
    .is("deleted_at", null)
    .lte("next_action_at", nowIso())
    .order("next_action_at", { ascending: true })
    .limit(TICK_LIMIT)
    .returns<EnrollmentRow[]>();

  if (dueErr) {
    await logError(ROUTE, `due query failed: ${dueErr.message}`, {});
    return NextResponse.json({ error: dueErr.message }, { status: 500 });
  }

  for (const enrollment of due ?? []) {
    result.processed += 1;

    try {
      const targetStepNumber = enrollment.current_step + 1;

      const { data: step, error: stepErr } = await adminClient
        .from("campaign_steps")
        .select("id, step_number, delay_days, template_slug")
        .eq("campaign_id", enrollment.campaign_id)
        .eq("step_number", targetStepNumber)
        .is("deleted_at", null)
        .maybeSingle<CampaignStepRow>();

      if (stepErr) {
        await logError(ROUTE, `step lookup failed: ${stepErr.message}`, {
          enrollmentId: enrollment.id,
        });
        result.failed += 1;
        continue;
      }

      if (!step) {
        // No further step -> mark enrollment completed.
        const { error: completeErr } = await adminClient
          .from("campaign_enrollments")
          .update({ status: "completed", completed_at: nowIso(), next_action_at: null })
          .eq("id", enrollment.id);
        if (completeErr) {
          await logError(ROUTE, `complete failed: ${completeErr.message}`, {
            enrollmentId: enrollment.id,
          });
          result.failed += 1;
          continue;
        }
        await writeEvent({
          actorId: ACTOR,
          verb: "campaign.completed",
          object: { table: "campaign_enrollments", id: enrollment.id },
          context: {
            campaign_id: enrollment.campaign_id,
            contact_id: enrollment.contact_id,
            final_step: enrollment.current_step,
          },
        });
        result.completed += 1;
        continue;
      }

      // NULL template_slug -> skip (cadence preserved).
      if (!step.template_slug) {
        const nextDelay = await lookupNextStepDelay(
          enrollment.campaign_id,
          targetStepNumber + 1,
        );
        await adminClient
          .from("campaign_enrollments")
          .update({
            current_step: targetStepNumber,
            next_action_at:
              nextDelay !== null
                ? fromEnrollmentIso(enrollment.enrolled_at, nextDelay)
                : nowIso(),
          })
          .eq("id", enrollment.id);
        await writeEvent({
          actorId: ACTOR,
          verb: "campaign.step_skipped",
          object: { table: "campaign_enrollments", id: enrollment.id },
          context: {
            campaign_id: enrollment.campaign_id,
            contact_id: enrollment.contact_id,
            step_id: step.id,
            step_number: targetStepNumber,
            reason: "template_slug_null",
          },
        });
        result.skipped += 1;
        continue;
      }

      // Resolve contact for recipient + template variables.
      const { data: contact, error: contactErr } = await adminClient
        .from("contacts")
        .select("id, email, first_name, last_name, full_name, deleted_at")
        .eq("id", enrollment.contact_id)
        .maybeSingle<ContactRow>();

      if (contactErr || !contact || contact.deleted_at || !contact.email) {
        const nextDelay = await lookupNextStepDelay(
          enrollment.campaign_id,
          targetStepNumber + 1,
        );
        await adminClient
          .from("campaign_enrollments")
          .update({
            current_step: targetStepNumber,
            next_action_at:
              nextDelay !== null
                ? fromEnrollmentIso(enrollment.enrolled_at, nextDelay)
                : nowIso(),
          })
          .eq("id", enrollment.id);
        await writeEvent({
          actorId: ACTOR,
          verb: "campaign.step_skipped",
          object: { table: "campaign_enrollments", id: enrollment.id },
          context: {
            campaign_id: enrollment.campaign_id,
            contact_id: enrollment.contact_id,
            step_id: step.id,
            step_number: targetStepNumber,
            reason: contact?.deleted_at
              ? "contact_deleted"
              : !contact
                ? "contact_not_found"
                : "contact_email_missing",
          },
        });
        result.skipped += 1;
        continue;
      }

      // Send.
      // Pass both snake_case and camelCase variable keys so templates authored
      // in either convention render correctly. The renderer is exact-match per
      // src/lib/messaging/render.ts (Slice 4 Task 3).
      const fullName =
        contact.full_name ??
        `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
      let send;
      try {
        send = await sendMessage({
          templateSlug: step.template_slug,
          recipient: contact.email,
          variables: {
            first_name: contact.first_name ?? "",
            last_name: contact.last_name ?? "",
            full_name: fullName,
            firstName: contact.first_name ?? "",
            lastName: contact.last_name ?? "",
            fullName,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await writeEvent({
          actorId: ACTOR,
          verb: "campaign.send_failed",
          object: { table: "campaign_enrollments", id: enrollment.id },
          context: {
            campaign_id: enrollment.campaign_id,
            contact_id: enrollment.contact_id,
            step_id: step.id,
            step_number: targetStepNumber,
            template_slug: step.template_slug,
            error: message,
          },
        });
        await logError(ROUTE, `sendMessage failed: ${message}`, {
          enrollmentId: enrollment.id,
        });
        result.failed += 1;
        // Do NOT advance current_step or next_action_at; next tick retries.
        continue;
      }

      // Advance enrollment. next_action_at is computed from the NEXT step's
      // absolute delay_days offset against enrolled_at, not the just-fired
      // step's delay_days. If no step N+1 exists, schedule "now" so the next
      // tick finds no step and marks the enrollment completed.
      const nextDelayAfterSend = await lookupNextStepDelay(
        enrollment.campaign_id,
        targetStepNumber + 1,
      );
      const nextActionAt =
        nextDelayAfterSend !== null
          ? fromEnrollmentIso(enrollment.enrolled_at, nextDelayAfterSend)
          : nowIso();
      const { error: advanceErr } = await adminClient
        .from("campaign_enrollments")
        .update({
          current_step: targetStepNumber,
          next_action_at: nextActionAt,
        })
        .eq("id", enrollment.id);
      if (advanceErr) {
        await logError(ROUTE, `advance failed: ${advanceErr.message}`, {
          enrollmentId: enrollment.id,
        });
        // Send already happened; do not mark as failed -- log and continue.
      }

      // Record completion row + activity event.
      await adminClient.from("campaign_step_completions").insert({
        enrollment_id: enrollment.id,
        step_id: step.id,
        completed_at: nowIso(),
        email_sent_at: send.sentAt,
        resend_message_id: send.providerMessageId,
        user_id: enrollment.user_id,
      });

      await writeEvent({
        actorId: ACTOR,
        verb: "campaign.step_fired",
        object: { table: "campaign_enrollments", id: enrollment.id },
        context: {
          campaign_id: enrollment.campaign_id,
          contact_id: enrollment.contact_id,
          step_id: step.id,
          step_number: targetStepNumber,
          template_slug: step.template_slug,
          message_log_id: send.logId,
          provider_message_id: send.providerMessageId,
          send_mode: send.sendMode,
        },
      });
      result.sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logError(ROUTE, `tick error: ${message}`, {
        enrollmentId: enrollment.id,
      });
      result.failed += 1;
    }
  }

  return NextResponse.json({
    ...result,
    durationMs: Date.now() - startedAt,
  });
}
