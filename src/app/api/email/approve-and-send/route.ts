// Phase 1.3.1 Phase 5 -- Approve + send / draft / discard / revise.
// POST { draft_id, action, revised_body? }. Auth: Supabase session OR Bearer CRON_SECRET.
// Actions:
//   send_now           -- send via Resend, then fire mark-read.
//   create_gmail_draft -- create draft inside Gmail web UI.
//   discard            -- mark draft 'discarded'.
//   revise             -- bump revisions_count, reset expires_at, store revised body.
// Rejects expired or already-sent drafts with 409.
// Every action appends an event to email_drafts.audit_log.event_sequence.
//
// Pure state-machine logic + audit builders live in
// `src/lib/messaging/draftActions.ts` (tested under draftActions.test.ts).
// This handler owns: auth, body parsing, Supabase I/O, Resend send, Gmail
// draft creation, fire-and-forget mark-read, writeEvent emission, and HTTP
// response shaping. Keep the I/O orchestration here, audit-shape decisions
// there.
import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { sendDraft } from "@/lib/resend/client";
import { createGmailDraft } from "@/lib/gmail/sync-client";
import { verifyBearerOrSession } from "@/lib/api-auth";
import { logError } from "@/lib/error-log";
import { ALEX_EMAIL } from "@/lib/constants";
import { writeEvent } from "@/lib/activity/writeEvent";
import {
  type Action,
  type DraftState,
  buildApprovedAudit,
  buildDiscardAudit,
  buildGmailDraftAudit,
  buildGmailDraftFailAudit,
  buildMarkReadAudit,
  buildReviseTransition,
  buildSendFailAudit,
  buildSentAudit,
  htmlToPlain,
  isValidAction,
  validateAction,
} from "@/lib/messaging/draftActions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ROUTE = "/api/email/approve-and-send";

interface RequestBody {
  draft_id?: string;
  action?: Action;
  revised_body?: string;
  revised_subject?: string;
}

interface DraftRow extends DraftState {
  id: string;
  email_id: string;
  user_id: string;
  draft_body_html: string | null;
  metadata: Record<string, unknown> | null;
}

interface EmailRow {
  id: string;
  gmail_id: string;
  gmail_thread_id: string | null;
  from_email: string;
  from_name: string | null;
  subject: string;
  contact_id: string | null;
}

function fireMarkRead(emailId: string, origin: string) {
  const url = `${origin}/api/gmail/mark-read`;
  fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`,
    },
    body: JSON.stringify({ email_id: emailId }),
  }).catch(() => {
    // fire-and-forget; failures land in error_logs from the mark-read route itself.
  });
}

export async function POST(request: NextRequest) {
  if (process.env.ROLLBACK_SEND === "true") {
    // Allow non-send actions even with kill-switch on (per spec graceful degrade).
    let body: RequestBody;
    try {
      body = (await request.clone().json()) as RequestBody;
    } catch {
      body = {};
    }
    if (body.action === "send_now") {
      return NextResponse.json({ error: "Send disabled" }, { status: 503 });
    }
  }

  if (!(await verifyBearerOrSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const draftId = body.draft_id;
  const action = body.action;
  if (!draftId || typeof draftId !== "string") {
    return NextResponse.json({ error: "draft_id is required" }, { status: 400 });
  }
  if (!isValidAction(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { data: draft, error: draftErr } = await adminClient
    .from("email_drafts")
    .select(
      "id, email_id, user_id, draft_subject, draft_body_plain, draft_body_html, status, expires_at, revisions_count, escalation_flag, audit_log, metadata",
    )
    .eq("id", draftId)
    .maybeSingle<DraftRow>();

  if (draftErr) {
    await logError(ROUTE, `draft lookup failed: ${draftErr.message}`, { draft_id: draftId });
    return NextResponse.json({ error: "Draft lookup failed" }, { status: 500 });
  }
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const now = new Date();
  const validation = validateAction(draft, action, now);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  if (action === "discard") {
    const audit = buildDiscardAudit(draft, now.toISOString());
    const { error: updErr } = await adminClient
      .from("email_drafts")
      .update({ status: "discarded", audit_log: audit })
      .eq("id", draftId);
    if (updErr) {
      await logError(ROUTE, `discard update failed: ${updErr.message}`, { draft_id: draftId });
      return NextResponse.json({ error: "Discard update failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action, draft_id: draftId, status: "discarded" });
  }

  if (action === "revise") {
    const newBody = (body.revised_body ?? "").trim();
    if (!newBody) {
      return NextResponse.json({ error: "revised_body is required" }, { status: 400 });
    }
    const newSubject = body.revised_subject?.trim() || null;
    const transition = buildReviseTransition(draft, newBody, newSubject, now);
    const { error: updErr } = await adminClient
      .from("email_drafts")
      .update(transition)
      .eq("id", draftId);
    if (updErr) {
      await logError(ROUTE, `revise update failed: ${updErr.message}`, { draft_id: draftId });
      return NextResponse.json({ error: "Revise update failed" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      action,
      draft_id: draftId,
      revisions_count: transition.revisions_count,
      expires_at: transition.expires_at,
    });
  }

  // sending actions need the original email
  const { data: email, error: emailErr } = await adminClient
    .from("emails")
    .select("id, gmail_id, gmail_thread_id, from_email, from_name, subject, contact_id")
    .eq("id", draft.email_id)
    .maybeSingle<EmailRow>();

  if (emailErr) {
    await logError(ROUTE, `email lookup failed: ${emailErr.message}`, { draft_id: draftId });
    return NextResponse.json({ error: "Email lookup failed" }, { status: 500 });
  }
  if (!email) {
    return NextResponse.json({ error: "Original email not found" }, { status: 404 });
  }

  const subject = draft.draft_subject?.trim() || `Re: ${email.subject}`;
  const html =
    draft.draft_body_html ??
    `<div>${(draft.draft_body_plain ?? "").replace(/\n/g, "<br>")}</div>`;
  const text = draft.draft_body_plain ?? htmlToPlain(html);

  if (action === "send_now") {
    const approvedAudit = buildApprovedAudit(draft, "send_now", now.toISOString());

    let sendResult;
    try {
      sendResult = await sendDraft({
        to: email.from_email,
        subject,
        html,
        text,
        replyTo: ALEX_EMAIL,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "resend send failed";
      const failAudit = buildSendFailAudit(approvedAudit, message);
      await adminClient
        .from("email_drafts")
        .update({ audit_log: failAudit })
        .eq("id", draftId);
      await logError(ROUTE, `resend send failed: ${message}`, { draft_id: draftId });
      return NextResponse.json({ error: "Send failed" }, { status: 502 });
    }

    const sentAt = new Date().toISOString();
    const sentAudit = buildSentAudit(approvedAudit, sentAt, sendResult);

    const { error: updErr } = await adminClient
      .from("email_drafts")
      .update({
        status: "sent",
        sent_at: sentAt,
        sent_via: "resend",
        approved_at: sentAt,
        approved_by: ALEX_EMAIL,
        audit_log: sentAudit,
      })
      .eq("id", draftId);

    if (updErr) {
      await logError(ROUTE, `sent update failed: ${updErr.message}`, {
        draft_id: draftId,
        message_id: sendResult.messageId,
      });
      return NextResponse.json({ error: "Sent state update failed" }, { status: 500 });
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
    fireMarkRead(email.id, origin);

    void writeEvent({
      userId: draft.user_id,
      actorId: draft.user_id,
      verb: "email.sent",
      object: { table: "email_drafts", id: draftId },
      context: {
        email_id: draft.email_id,
        ...(email.contact_id ? { contact_id: email.contact_id } : {}),
      },
    });

    // Record the mark-read intent in audit log immediately so it survives even
    // if the fire-and-forget request fails; the mark-read route logs its own errors.
    const finalAudit = buildMarkReadAudit(sentAudit, email.gmail_id);
    await adminClient
      .from("email_drafts")
      .update({ audit_log: finalAudit })
      .eq("id", draftId);

    return NextResponse.json({
      ok: true,
      action,
      draft_id: draftId,
      message_id: sendResult.messageId,
      redirected_to: sendResult.redirectedTo,
      sent_at: sentAt,
    });
  }

  if (action === "create_gmail_draft") {
    const approvedAudit = buildApprovedAudit(draft, "create_gmail_draft", now.toISOString());

    let result;
    try {
      result = await createGmailDraft({
        to: email.from_email,
        subject,
        bodyHtml: html,
        bodyPlain: text,
        threadId: email.gmail_thread_id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "gmail draft create failed";
      const failAudit = buildGmailDraftFailAudit(approvedAudit, message);
      await adminClient
        .from("email_drafts")
        .update({ audit_log: failAudit })
        .eq("id", draftId);
      await logError(ROUTE, `gmail draft create failed: ${message}`, { draft_id: draftId });
      return NextResponse.json({ error: "Gmail draft create failed" }, { status: 502 });
    }

    const sentAt = new Date().toISOString();
    const draftAudit = buildGmailDraftAudit(approvedAudit, sentAt, result);

    const { error: updErr } = await adminClient
      .from("email_drafts")
      .update({
        status: "sent",
        sent_at: sentAt,
        sent_via: "gmail_draft",
        approved_at: sentAt,
        approved_by: ALEX_EMAIL,
        created_in_gmail_draft_id: result.draftId,
        audit_log: draftAudit,
      })
      .eq("id", draftId);

    if (updErr) {
      await logError(ROUTE, `gmail draft state update failed: ${updErr.message}`, {
        draft_id: draftId,
        gmail_draft_id: result.draftId,
      });
      return NextResponse.json({ error: "Draft state update failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      action,
      draft_id: draftId,
      gmail_draft_id: result.draftId,
      gmail_message_id: result.messageId,
    });
  }

  // unreachable -- isValidAction guards this
  return NextResponse.json({ error: "Unhandled action" }, { status: 500 });
}
