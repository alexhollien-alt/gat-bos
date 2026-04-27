// Slice 4 Task 3 -- shared types for the messaging abstraction.
// Mirrors the public.templates + public.messages_log columns.

export type TemplateSendMode = "resend" | "gmail" | "both";
export type TemplateKind = "transactional" | "campaign" | "newsletter";

export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "bounced"
  | "opened"
  | "clicked"
  | "failed";

export interface TemplateRow {
  id: string;
  name: string;
  slug: string;
  send_mode: TemplateSendMode;
  subject: string;
  body_html: string;
  body_text: string;
  kind: TemplateKind;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MessageLogEvent {
  ts: string;
  event:
    | "queued"
    | "rendered"
    | "adapter_invoked"
    | "sent"
    | "failed"
    | "delivered"
    | "bounced"
    | "opened"
    | "clicked";
  payload?: Record<string, unknown>;
}

export interface MessageLogRow {
  id: string;
  template_id: string;
  recipient_email: string;
  send_mode: TemplateSendMode;
  provider_message_id: string | null;
  status: MessageStatus;
  event_sequence: MessageLogEvent[];
  sent_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface SendMessageInput {
  templateSlug: string;
  recipient: string;
  mode?: TemplateSendMode;
  variables?: Record<string, string>;
  // version pin: when set, resolves to that exact version instead of max(version)
  version?: number;
}

export interface SendMessageResult {
  ok: true;
  logId: string;
  templateId: string;
  templateVersion: number;
  recipient: string;
  sendMode: TemplateSendMode;
  providerMessageId: string;
  status: MessageStatus;
  sentAt: string;
}

export interface AdapterSendInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface AdapterSendResult {
  messageId: string;
}
