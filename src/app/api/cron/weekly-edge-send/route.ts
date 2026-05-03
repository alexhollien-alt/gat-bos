// Slice 8 Phase 4 -- Weekly Edge send cron.
//
// Schedule (registered in Phase 5): 0 20 * * 2 UTC (Tue 1 PM PHX).
// Manual trigger: GET with Bearer CRON_SECRET.
//
// Flow:
//   1. Auth (Bearer CRON_SECRET).
//   2. Find oldest approved campaign_drafts row (status='approved',
//      approved_at NOT NULL, sent_at NULL).
//   3. If none: emit campaign.send_skipped_unapproved, return 200 + skipped.
//   4. Resolve recipient list.
//   5. For each recipient, call sendMessage() with templateSlug='weekly-edge'
//      and the assembled variables. Track per-recipient success/failure.
//   6. Update draft row sent_at + status + send_summary.
//   7. Emit campaign.sent per success and campaign.send_failed per failure.

import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/api-auth";
import { logError } from "@/lib/error-log";
import { writeEvent } from "@/lib/activity/writeEvent";
import { sendMessage } from "@/lib/messaging/send";
import { resolveRecipientList } from "@/lib/campaigns/recipients";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ROUTE = "/api/cron/weekly-edge-send";

interface DraftRow {
  id: string;
  template_slug: string;
  template_version: number | null;
  recipient_list_slug: string;
  variables: Record<string, string> | null;
}

interface PerRecipientResult {
  recipient: string;
  ok: boolean;
  log_id?: string;
  error?: string;
}

async function resolveAccountOwnerId(): Promise<string | null> {
  const { data, error } = await adminClient
    .from("accounts")
    .select("owner_user_id")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    await logError(ROUTE, `accounts owner lookup failed: ${error.message}`, {});
    return null;
  }
  return data?.owner_user_id ?? null;
}

async function fetchOldestApproved(): Promise<DraftRow | null> {
  const { data, error } = await adminClient
    .from("campaign_drafts")
    .select("id, template_slug, template_version, recipient_list_slug, variables")
    .eq("status", "approved")
    .not("approved_at", "is", null)
    .is("sent_at", null)
    .is("deleted_at", null)
    .order("approved_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`campaign_drafts read failed: ${error.message}`);
  }
  return (data as DraftRow | null) ?? null;
}

async function handleRun(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const ownerUserId = await resolveAccountOwnerId();
  if (!ownerUserId) {
    return NextResponse.json({ error: "No account configured" }, { status: 500 });
  }

  const draft = await fetchOldestApproved();
  if (!draft) {
    await writeEvent({
      userId: ownerUserId,
      actorId: ownerUserId,
      verb: "campaign.send_skipped_unapproved",
      object: { table: "campaign_drafts", id: "none" },
      context: { reason: "no approved drafts at fire time" },
    });
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "no approved drafts at fire time",
      durationMs: Date.now() - startedAt,
    });
  }

  const list = await resolveRecipientList(draft.recipient_list_slug);
  if (list.recipients.length === 0) {
    await logError(ROUTE, `recipient list '${draft.recipient_list_slug}' resolved to 0 recipients`, {
      draft_id: draft.id,
    });
    return NextResponse.json(
      { error: "Recipient list empty", draft_id: draft.id },
      { status: 412 },
    );
  }

  const variables: Record<string, string> = draft.variables ?? {};
  const results: PerRecipientResult[] = [];

  for (const recipient of list.recipients) {
    try {
      const sent = await sendMessage({
        templateSlug: draft.template_slug,
        recipient: recipient.email,
        userId: recipient.userId ?? ownerUserId,
        variables,
        version: draft.template_version ?? undefined,
      });
      results.push({ recipient: recipient.email, ok: true, log_id: sent.logId });
      await writeEvent({
        userId: ownerUserId,
        actorId: ownerUserId,
        verb: "campaign.sent",
        object: { table: "campaign_drafts", id: draft.id },
        context: {
          recipient: recipient.email,
          contact_id: recipient.contactId,
          message_log_id: sent.logId,
          provider_message_id: sent.providerMessageId,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ recipient: recipient.email, ok: false, error: message });
      await writeEvent({
        userId: ownerUserId,
        actorId: ownerUserId,
        verb: "campaign.send_failed",
        object: { table: "campaign_drafts", id: draft.id },
        context: {
          recipient: recipient.email,
          contact_id: recipient.contactId,
          error: message,
        },
      });
    }
  }

  const sentCount = results.filter((r) => r.ok).length;
  const failedCount = results.length - sentCount;
  const finalStatus = failedCount === 0 ? "sent" : "send_failed";
  const sentAt = new Date().toISOString();

  const { error: updateErr } = await adminClient
    .from("campaign_drafts")
    .update({
      sent_at: sentAt,
      status: finalStatus,
      send_summary: {
        sent: sentCount,
        failed: failedCount,
        total: results.length,
        errors: results.filter((r) => !r.ok).map((r) => ({ recipient: r.recipient, error: r.error })),
      },
      updated_at: sentAt,
    })
    .eq("id", draft.id);

  if (updateErr) {
    await logError(ROUTE, `campaign_drafts update failed: ${updateErr.message}`, {
      draft_id: draft.id,
    });
  }

  return NextResponse.json({
    ok: failedCount === 0,
    draft_id: draft.id,
    sent: sentCount,
    failed: failedCount,
    total: results.length,
    final_status: finalStatus,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await handleRun(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "weekly-edge-send failed";
    await logError(ROUTE, `unhandled: ${message}`, {});
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
