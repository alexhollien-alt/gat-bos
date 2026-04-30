// Phase 1.3.1 Phase 4 -- Claude draft generation endpoint.
// POST only. Bearer CRON_SECRET. ROLLBACK_DRAFT_GEN gates 503.
// Idempotent: if a non-discarded draft exists for email_id, return it unchanged.
import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/api-auth";
import { logError } from "@/lib/error-log";
import {
  detectEscalation,
  generateDraft,
  PROMPT_VERSION,
  wrapReplyHtml,
  type DraftContext,
  type DraftEmailInput,
  type SenderTier,
} from "@/lib/claude/draft-client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ROUTE = "/api/email/generate-draft";

interface EmailRow {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string;
  body_plain: string | null;
  body_html: string | null;
  snippet: string | null;
  contact_id: string | null;
  user_id: string;
}

interface ContactRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  type: string | null;
}

interface ExistingDraftRow {
  id: string;
  status: string;
}

function mapContactToTier(contactType: string | null): SenderTier {
  if (!contactType) return "unknown";
  const t = contactType.toLowerCase();
  if (t.includes("lender")) return "lender";
  if (t.includes("agent")) return "A";
  if (t.includes("partner")) return "B";
  if (t.includes("admin") || t.includes("system")) return "system";
  return "C";
}

function contactNameFrom(contact: ContactRow | null): string | null {
  if (!contact) return null;
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
  return name || null;
}

async function handleGenerate(request: NextRequest) {
  if (process.env.ROLLBACK_DRAFT_GEN === "true") {
    return NextResponse.json({ error: "Draft generation disabled" }, { status: 503 });
  }
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email_id?: string };
  try {
    body = (await request.json()) as { email_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const emailId = body.email_id;
  if (!emailId || typeof emailId !== "string") {
    return NextResponse.json({ error: "email_id is required" }, { status: 400 });
  }

  // Idempotency -- return any non-discarded existing draft.
  const { data: existing, error: existingErr } = await adminClient
    .from("email_drafts")
    .select("id, status")
    .eq("email_id", emailId)
    .neq("status", "discarded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ExistingDraftRow>();

  if (existingErr) {
    await logError(ROUTE, `existing draft lookup failed: ${existingErr.message}`, {
      email_id: emailId,
    });
    return NextResponse.json({ error: "Draft lookup failed" }, { status: 500 });
  }

  if (existing?.id) {
    return NextResponse.json({
      ok: true,
      draft_id: existing.id,
      idempotent: true,
      status: existing.status,
    });
  }

  // Load email.
  const { data: email, error: emailErr } = await adminClient
    .from("emails")
    .select(
      "id, from_email, from_name, subject, body_plain, body_html, snippet, contact_id, user_id",
    )
    .eq("id", emailId)
    .maybeSingle<EmailRow>();

  if (emailErr) {
    await logError(ROUTE, `email load failed: ${emailErr.message}`, { email_id: emailId });
    return NextResponse.json({ error: "Email load failed" }, { status: 500 });
  }
  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  // Load contact (optional).
  let contact: ContactRow | null = null;
  if (email.contact_id) {
    const { data: c, error: cErr } = await adminClient
      .from("contacts")
      .select("id, first_name, last_name, type")
      .eq("id", email.contact_id)
      .maybeSingle<ContactRow>();
    if (cErr) {
      await logError(ROUTE, `contact load failed (non-fatal): ${cErr.message}`, {
        email_id: emailId,
        contact_id: email.contact_id,
      });
    } else {
      contact = c ?? null;
    }
  }

  const senderTier: SenderTier = contact
    ? mapContactToTier(contact.type)
    : "unknown";

  const draftInput: DraftEmailInput = {
    from_email: email.from_email,
    from_name: email.from_name,
    subject: email.subject,
    body_plain: email.body_plain,
    body_html: email.body_html,
    snippet: email.snippet,
  };

  const draftContext: DraftContext = {
    senderTier,
    contactName: contactNameFrom(contact),
    contactRelationship: contact?.type ?? null,
    matchReason: email.contact_id ? "contact_match" : "domain_match",
  };

  let draft;
  try {
    draft = await generateDraft(draftInput, draftContext, email.user_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "claude generation failed";
    await logError(ROUTE, `claude generation failed: ${message}`, {
      email_id: emailId,
      sender_tier: senderTier,
    });
    return NextResponse.json({ error: "Draft generation failed" }, { status: 502 });
  }

  const escalation = detectEscalation(
    email.subject,
    email.body_plain ?? email.snippet ?? "",
    draft.body,
  );

  const generatedAt = new Date().toISOString();
  const auditEvent = {
    timestamp: generatedAt,
    event: "draft_generated",
    model: draft.model,
    input_tokens: draft.input_tokens,
    output_tokens: draft.output_tokens,
    cache_read_tokens: draft.cache_read_tokens,
    cache_creation_tokens: draft.cache_creation_tokens,
    claude_tokens_used: draft.input_tokens + draft.output_tokens,
    prompt_version: draft.prompt_version ?? PROMPT_VERSION,
    filter_reason: draftContext.matchReason,
    sender_tier: senderTier,
    escalation_flag: escalation.flag,
    escalation_matched_labels: escalation.matched_labels,
  };

  // Phase 1.3.2-A: emit escalation_surfaced once per draft, at the moment the
  // flag stamps onto the row. The /drafts dashboard renders the badge from the
  // first realtime push, so the draft row's existence == surfaced.
  const eventSequence: Array<Record<string, unknown>> = [auditEvent];
  if (escalation.flag) {
    eventSequence.push({
      timestamp: generatedAt,
      event: "escalation_surfaced",
      escalation_flag: escalation.flag,
      escalation_reason: escalation.reason,
      escalation_matched_labels: escalation.matched_labels,
    });
  }

  const auditMetadata = {
    original_email_id: email.id,
    original_from: email.from_email,
    original_subject: email.subject,
    escalation_flag: escalation.flag,
    contact_relationship: draftContext.contactRelationship,
    sender_tier: senderTier,
  };

  const { data: inserted, error: insertErr } = await adminClient
    .from("email_drafts")
    .insert({
      email_id: email.id,
      draft_subject: draft.subject,
      draft_body_plain: draft.body,
      draft_body_html: wrapReplyHtml(draft.body),
      status: "generated",
      escalation_flag: escalation.flag,
      escalation_reason: escalation.reason,
      generated_at: generatedAt,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      audit_log: {
        event_sequence: eventSequence,
        metadata: auditMetadata,
      },
      metadata: {
        sender_tier: senderTier,
        prompt_version: draft.prompt_version,
      },
    })
    .select("id")
    .single<{ id: string }>();

  if (insertErr || !inserted) {
    const msg = insertErr?.message ?? "insert returned no row";
    await logError(ROUTE, `email_drafts insert failed: ${msg}`, {
      email_id: emailId,
      sender_tier: senderTier,
    });
    return NextResponse.json({ error: "Draft insert failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    draft_id: inserted.id,
    idempotent: false,
    escalation_flag: escalation.flag,
    escalation_reason: escalation.reason,
    tokens: {
      input: draft.input_tokens,
      output: draft.output_tokens,
      cache_read: draft.cache_read_tokens,
      cache_creation: draft.cache_creation_tokens,
    },
    model: draft.model,
  });
}

export async function POST(request: NextRequest) {
  try {
    return await handleGenerate(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "generate-draft failed";
    await logError(ROUTE, `unhandled exception: ${message}`, {});
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
