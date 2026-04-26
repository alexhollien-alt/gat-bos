// Pure state machine + audit log builders for /api/email/approve-and-send.
// No I/O, no NextRequest, no Supabase. All I/O orchestration stays in the
// route handler. Tested in draftActions.test.ts.
//
// Audit ordering contract: when a draft has an escalation_flag, the
// escalation lifecycle event is ALWAYS prepended before the user action
// event in the same audit_log update. This ordering is load-bearing -- the
// audit reads in causal order (escalation first, then user action). Tests
// lock this so future edits cannot quietly swap the sequence.

export type Action = "send_now" | "create_gmail_draft" | "discard" | "revise";
export type EscalationFlag = "marlene" | "agent_followup" | null;

export const VALID_ACTIONS: readonly Action[] = [
  "send_now",
  "create_gmail_draft",
  "discard",
  "revise",
];

// Revise resets the draft TTL to 30 minutes from now.
export const REVISE_TTL_MS = 30 * 60 * 1000;

export interface AuditEvent {
  timestamp: string;
  event: string;
  [key: string]: unknown;
}

export interface AuditLog {
  event_sequence: AuditEvent[];
  metadata: Record<string, unknown>;
}

// The subset of email_drafts row data the pure helpers read.
export interface DraftState {
  status: string;
  expires_at: string;
  escalation_flag: EscalationFlag;
  audit_log: AuditLog | null;
  revisions_count: number;
  draft_subject: string | null;
  draft_body_plain: string | null;
}

export interface SendResult {
  messageId: string;
  originalTo: string;
  redirectedTo?: string | null;
}

export interface GmailDraftResult {
  draftId: string;
  messageId: string;
}

export function appendAuditEvent(
  audit: AuditLog | null,
  event: AuditEvent,
): AuditLog {
  const base: AuditLog = audit ?? { event_sequence: [], metadata: {} };
  return {
    event_sequence: [...(base.event_sequence ?? []), event],
    metadata: base.metadata ?? {},
  };
}

export function escalationLifecycleEvent(
  flag: EscalationFlag,
  action: Action,
  timestamp: string,
): AuditEvent | null {
  if (!flag) return null;
  return {
    timestamp,
    event: action === "discard" ? "escalation_cleared" : "escalation_acknowledged",
    escalation_flag: flag,
    action,
  };
}

// Apply escalation event (if any) BEFORE the action event. Load-bearing order.
function applyWithEscalation(
  audit: AuditLog | null,
  flag: EscalationFlag,
  action: Action,
  ts: string,
  actionEvent: AuditEvent,
): AuditLog {
  const escalation = escalationLifecycleEvent(flag, action, ts);
  const base = escalation ? appendAuditEvent(audit, escalation) : audit;
  return appendAuditEvent(base, actionEvent);
}

export interface ActionValidation {
  ok: boolean;
  status?: number;
  error?: string;
}

export function isValidAction(value: unknown): value is Action {
  return (
    typeof value === "string" &&
    (VALID_ACTIONS as readonly string[]).includes(value)
  );
}

export function validateAction(
  draft: Pick<DraftState, "status" | "expires_at">,
  action: Action,
  now: Date,
): ActionValidation {
  if (draft.status === "sent") {
    return { ok: false, status: 409, error: "Draft already sent" };
  }
  const expiresAt = new Date(draft.expires_at);
  const isExpired =
    Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < now.getTime();
  const sendingAction = action === "send_now" || action === "create_gmail_draft";
  if (isExpired && sendingAction) {
    return { ok: false, status: 409, error: "Draft expired" };
  }
  return { ok: true };
}

export function buildDiscardAudit(draft: DraftState, ts: string): AuditLog {
  return applyWithEscalation(draft.audit_log, draft.escalation_flag, "discard", ts, {
    timestamp: ts,
    event: "user_discarded",
  });
}

export interface ReviseTransition {
  draft_body_plain: string;
  draft_subject: string | null;
  revisions_count: number;
  expires_at: string;
  status: "revised";
  audit_log: AuditLog;
}

export function buildReviseTransition(
  draft: DraftState,
  newBody: string,
  newSubject: string | null,
  now: Date,
): ReviseTransition {
  const ts = now.toISOString();
  const audit = applyWithEscalation(draft.audit_log, draft.escalation_flag, "revise", ts, {
    timestamp: ts,
    event: "user_revised",
    previous_body: draft.draft_body_plain,
    previous_subject: draft.draft_subject,
    revisions_count_after: draft.revisions_count + 1,
  });
  return {
    draft_body_plain: newBody,
    draft_subject: newSubject ?? draft.draft_subject,
    revisions_count: draft.revisions_count + 1,
    expires_at: new Date(now.getTime() + REVISE_TTL_MS).toISOString(),
    status: "revised",
    audit_log: audit,
  };
}

export function buildApprovedAudit(
  draft: DraftState,
  action: Extract<Action, "send_now" | "create_gmail_draft">,
  ts: string,
): AuditLog {
  return applyWithEscalation(draft.audit_log, draft.escalation_flag, action, ts, {
    timestamp: ts,
    event: "user_approved",
    action,
  });
}

export function buildSendFailAudit(
  approvedAudit: AuditLog,
  errorMessage: string,
): AuditLog {
  return appendAuditEvent(approvedAudit, {
    timestamp: new Date().toISOString(),
    event: "send_failed",
    error: errorMessage,
  });
}

export function buildSentAudit(
  approvedAudit: AuditLog,
  sentAt: string,
  sendResult: SendResult,
): AuditLog {
  return appendAuditEvent(approvedAudit, {
    timestamp: sentAt,
    event: "sent_via_resend",
    message_id: sendResult.messageId,
    original_to: sendResult.originalTo,
    redirected_to: sendResult.redirectedTo,
  });
}

export function buildMarkReadAudit(
  sentAudit: AuditLog,
  gmailId: string,
): AuditLog {
  return appendAuditEvent(sentAudit, {
    timestamp: new Date().toISOString(),
    event: "original_email_marked_read",
    gmail_id: gmailId,
  });
}

export function buildGmailDraftFailAudit(
  approvedAudit: AuditLog,
  errorMessage: string,
): AuditLog {
  return appendAuditEvent(approvedAudit, {
    timestamp: new Date().toISOString(),
    event: "gmail_draft_failed",
    error: errorMessage,
  });
}

export function buildGmailDraftAudit(
  approvedAudit: AuditLog,
  sentAt: string,
  result: GmailDraftResult,
): AuditLog {
  return appendAuditEvent(approvedAudit, {
    timestamp: sentAt,
    event: "sent_via_gmail_draft",
    gmail_draft_id: result.draftId,
    gmail_message_id: result.messageId,
  });
}

export function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
