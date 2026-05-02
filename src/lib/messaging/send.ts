// Slice 4 Task 3 -- sendMessage() abstraction.
//
// Resolves a template by slug (max version where deleted_at IS NULL,
// or the explicit { version } pin), renders subject + body_html +
// body_text via the Handlebars-lite renderer, dispatches to the chosen
// adapter, and writes a messages_log row that reflects the lifecycle
// (queued -> sent or failed). event_sequence mirrors the email_drafts
// audit_log shape from Phase 5: append-only array of { ts, event, payload }.
//
// Mode resolution:
//   explicit `mode` arg always wins
//   else use template.send_mode
//   `both` routes the live send through Gmail and additionally fires
//   Resend so the same content surfaces through Resend's open/click
//   instrumentation; the Resend send is non-fatal if it fails (Gmail
//   delivered the user-facing copy already).
//
// On adapter error, the row flips to status='failed', appends a `failed`
// event with the error message, and the error rethrows so callers can
// surface a 5xx.
import { adminClient } from "@/lib/supabase/admin";
import { sendViaResend } from "./adapters/resend";
import { sendViaGmail } from "./adapters/gmail";
import { renderTemplate } from "./render";
import type {
  AdapterSendResult,
  MessageLogEvent,
  MessageLogRow,
  MessageStatus,
  SendMessageInput,
  SendMessageResult,
  TemplateRow,
  TemplateSendMode,
} from "./types";

async function resolveTemplate(
  slug: string,
  pinnedVersion?: number,
): Promise<TemplateRow> {
  const builder = adminClient
    .from("templates")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null);

  const query =
    pinnedVersion !== undefined
      ? builder.eq("version", pinnedVersion).maybeSingle<TemplateRow>()
      : builder.order("version", { ascending: false }).limit(1).maybeSingle<TemplateRow>();

  const { data, error } = await query;
  if (error) throw new Error(`Template lookup failed: ${error.message}`);
  if (!data) {
    throw new Error(
      pinnedVersion !== undefined
        ? `Template not found: slug='${slug}' version=${pinnedVersion}`
        : `Template not found: slug='${slug}'`,
    );
  }
  return data;
}

async function insertLogRow(row: {
  template_id: string;
  recipient_email: string;
  send_mode: TemplateSendMode;
  status: MessageStatus;
  event_sequence: MessageLogEvent[];
  user_id: string;
}): Promise<MessageLogRow> {
  const { data, error } = await adminClient
    .from("messages_log")
    .insert(row)
    .select("*")
    .single<MessageLogRow>();
  if (error) throw new Error(`messages_log insert failed: ${error.message}`);
  return data;
}

async function patchLogRow(
  id: string,
  patch: {
    status?: MessageStatus;
    provider_message_id?: string | null;
    sent_at?: string | null;
    event_sequence?: MessageLogEvent[];
  },
): Promise<void> {
  const { error } = await adminClient.from("messages_log").update(patch).eq("id", id);
  if (error) throw new Error(`messages_log update failed: ${error.message}`);
}

function nowIso(): string {
  return new Date().toISOString();
}

function appendEvent(seq: MessageLogEvent[], next: MessageLogEvent): MessageLogEvent[] {
  return [...seq, next];
}

async function dispatch(
  mode: TemplateSendMode,
  payload: { to: string; subject: string; html: string; text: string },
): Promise<{ primary: AdapterSendResult; fallback?: AdapterSendResult | { error: string } }> {
  if (mode === "resend") {
    return { primary: await sendViaResend(payload) };
  }
  if (mode === "gmail") {
    return { primary: await sendViaGmail(payload) };
  }
  // both: Gmail is primary (user-facing delivery); Resend is fallback
  // for instrumentation. Resend failures do not fail the call.
  const primary = await sendViaGmail(payload);
  let fallback: AdapterSendResult | { error: string };
  try {
    fallback = await sendViaResend(payload);
  } catch (err) {
    fallback = { error: err instanceof Error ? err.message : String(err) };
  }
  return { primary, fallback };
}

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const template = await resolveTemplate(input.templateSlug, input.version);
  const mode: TemplateSendMode = input.mode ?? template.send_mode;

  const subject = renderTemplate(template.subject, input.variables);
  const html = renderTemplate(template.body_html, input.variables);
  const text = renderTemplate(template.body_text, input.variables);

  const unresolved = Array.from(
    new Set([...subject.unresolved, ...html.unresolved, ...text.unresolved]),
  );

  let events: MessageLogEvent[] = [
    { ts: nowIso(), event: "queued", payload: { slug: template.slug, version: template.version } },
    {
      ts: nowIso(),
      event: "rendered",
      payload: unresolved.length > 0 ? { unresolved } : { unresolved: [] },
    },
  ];

  const log = await insertLogRow({
    template_id: template.id,
    recipient_email: input.recipient,
    send_mode: mode,
    status: "queued",
    event_sequence: events,
    user_id: input.userId,
  });

  events = appendEvent(events, {
    ts: nowIso(),
    event: "adapter_invoked",
    payload: { mode },
  });

  let dispatched: Awaited<ReturnType<typeof dispatch>>;
  try {
    dispatched = await dispatch(mode, {
      to: input.recipient,
      subject: subject.output,
      html: html.output,
      text: text.output,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    events = appendEvent(events, {
      ts: nowIso(),
      event: "failed",
      payload: { error: message },
    });
    await patchLogRow(log.id, {
      status: "failed",
      event_sequence: events,
    });
    throw err;
  }

  const sentAt = nowIso();
  events = appendEvent(events, {
    ts: sentAt,
    event: "sent",
    payload: {
      provider_message_id: dispatched.primary.messageId,
      ...(dispatched.fallback
        ? "messageId" in dispatched.fallback
          ? { fallback_message_id: dispatched.fallback.messageId }
          : { fallback_error: dispatched.fallback.error }
        : {}),
    },
  });

  await patchLogRow(log.id, {
    status: "sent",
    provider_message_id: dispatched.primary.messageId,
    sent_at: sentAt,
    event_sequence: events,
  });

  return {
    ok: true,
    logId: log.id,
    templateId: template.id,
    templateVersion: template.version,
    recipient: input.recipient,
    sendMode: mode,
    providerMessageId: dispatched.primary.messageId,
    status: "sent",
    sentAt,
  };
}
