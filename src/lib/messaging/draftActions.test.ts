import { describe, it, expect } from "vitest";
import {
  appendAuditEvent,
  escalationLifecycleEvent,
  isValidAction,
  validateAction,
  buildDiscardAudit,
  buildReviseTransition,
  buildApprovedAudit,
  buildSendFailAudit,
  buildSentAudit,
  buildMarkReadAudit,
  buildGmailDraftFailAudit,
  buildGmailDraftAudit,
  htmlToPlain,
  REVISE_TTL_MS,
  type DraftState,
  type AuditLog,
} from "./draftActions";

const ALEX_NOW = new Date("2026-04-24T12:00:00.000Z");

function freshDraft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    status: "generated",
    expires_at: new Date(ALEX_NOW.getTime() + 30 * 60 * 1000).toISOString(),
    escalation_flag: null,
    audit_log: null,
    revisions_count: 0,
    draft_subject: "Re: Test",
    draft_body_plain: "hello",
    ...overrides,
  };
}

describe("appendAuditEvent", () => {
  it("initializes from null audit_log", () => {
    const result = appendAuditEvent(null, {
      timestamp: ALEX_NOW.toISOString(),
      event: "user_discarded",
    });
    expect(result.event_sequence).toHaveLength(1);
    expect(result.event_sequence[0].event).toBe("user_discarded");
    expect(result.metadata).toEqual({});
  });

  it("appends to existing event_sequence", () => {
    const initial: AuditLog = {
      event_sequence: [{ timestamp: "2026-01-01T00:00:00Z", event: "draft_created" }],
      metadata: { foo: "bar" },
    };
    const result = appendAuditEvent(initial, {
      timestamp: ALEX_NOW.toISOString(),
      event: "user_approved",
    });
    expect(result.event_sequence).toHaveLength(2);
    expect(result.event_sequence[0].event).toBe("draft_created");
    expect(result.event_sequence[1].event).toBe("user_approved");
    expect(result.metadata).toEqual({ foo: "bar" });
  });
});

describe("escalationLifecycleEvent", () => {
  it("returns null when flag is null", () => {
    expect(escalationLifecycleEvent(null, "send_now", ALEX_NOW.toISOString())).toBeNull();
  });

  it("returns escalation_cleared on discard", () => {
    const e = escalationLifecycleEvent("marlene", "discard", ALEX_NOW.toISOString());
    expect(e?.event).toBe("escalation_cleared");
    expect(e?.escalation_flag).toBe("marlene");
    expect(e?.action).toBe("discard");
  });

  it("returns escalation_acknowledged on send_now", () => {
    const e = escalationLifecycleEvent("agent_followup", "send_now", ALEX_NOW.toISOString());
    expect(e?.event).toBe("escalation_acknowledged");
    expect(e?.escalation_flag).toBe("agent_followup");
  });

  it("returns escalation_acknowledged on revise", () => {
    const e = escalationLifecycleEvent("marlene", "revise", ALEX_NOW.toISOString());
    expect(e?.event).toBe("escalation_acknowledged");
  });

  it("returns escalation_acknowledged on create_gmail_draft", () => {
    const e = escalationLifecycleEvent("agent_followup", "create_gmail_draft", ALEX_NOW.toISOString());
    expect(e?.event).toBe("escalation_acknowledged");
  });
});

describe("isValidAction", () => {
  it.each([
    ["send_now", true],
    ["create_gmail_draft", true],
    ["discard", true],
    ["revise", true],
    ["forward", false],
    ["", false],
    [undefined, false],
    [null, false],
    [42, false],
  ])("isValidAction(%p) = %p", (input, expected) => {
    expect(isValidAction(input)).toBe(expected);
  });
});

describe("validateAction", () => {
  it("rejects status='sent' with 409 'Draft already sent'", () => {
    const v = validateAction({ status: "sent", expires_at: "2099-01-01T00:00:00Z" }, "send_now", ALEX_NOW);
    expect(v.ok).toBe(false);
    expect(v.status).toBe(409);
    expect(v.error).toBe("Draft already sent");
  });

  it("rejects expired draft on send_now with 409 'Draft expired'", () => {
    const v = validateAction(
      { status: "generated", expires_at: "2026-04-24T11:00:00.000Z" },
      "send_now",
      ALEX_NOW,
    );
    expect(v.ok).toBe(false);
    expect(v.status).toBe(409);
    expect(v.error).toBe("Draft expired");
  });

  it("rejects expired draft on create_gmail_draft with 409 'Draft expired'", () => {
    const v = validateAction(
      { status: "generated", expires_at: "2026-04-24T11:00:00.000Z" },
      "create_gmail_draft",
      ALEX_NOW,
    );
    expect(v.ok).toBe(false);
    expect(v.status).toBe(409);
    expect(v.error).toBe("Draft expired");
  });

  it("ALLOWS expired draft on discard", () => {
    const v = validateAction(
      { status: "generated", expires_at: "2026-04-24T11:00:00.000Z" },
      "discard",
      ALEX_NOW,
    );
    expect(v.ok).toBe(true);
  });

  it("ALLOWS expired draft on revise (revise resets expiry)", () => {
    const v = validateAction(
      { status: "generated", expires_at: "2026-04-24T11:00:00.000Z" },
      "revise",
      ALEX_NOW,
    );
    expect(v.ok).toBe(true);
  });

  it("ok on a fresh draft", () => {
    const v = validateAction(
      { status: "generated", expires_at: "2099-01-01T00:00:00Z" },
      "send_now",
      ALEX_NOW,
    );
    expect(v.ok).toBe(true);
  });

  it("treats malformed expires_at as not expired", () => {
    const v = validateAction(
      { status: "generated", expires_at: "not-a-date" },
      "send_now",
      ALEX_NOW,
    );
    expect(v.ok).toBe(true);
  });
});

describe("buildDiscardAudit -- escalation prepend ordering", () => {
  it("with no escalation, produces 1 event (user_discarded)", () => {
    const audit = buildDiscardAudit(freshDraft(), ALEX_NOW.toISOString());
    expect(audit.event_sequence).toHaveLength(1);
    expect(audit.event_sequence[0].event).toBe("user_discarded");
  });

  it("with escalation_flag='marlene', produces [escalation_cleared, user_discarded]", () => {
    const audit = buildDiscardAudit(
      freshDraft({ escalation_flag: "marlene" }),
      ALEX_NOW.toISOString(),
    );
    expect(audit.event_sequence).toHaveLength(2);
    expect(audit.event_sequence[0].event).toBe("escalation_cleared");
    expect(audit.event_sequence[0].escalation_flag).toBe("marlene");
    expect(audit.event_sequence[1].event).toBe("user_discarded");
  });

  it("preserves existing audit_log entries before prepending", () => {
    const existing: AuditLog = {
      event_sequence: [{ timestamp: "2026-01-01T00:00:00Z", event: "draft_created" }],
      metadata: {},
    };
    const audit = buildDiscardAudit(
      freshDraft({ escalation_flag: "agent_followup", audit_log: existing }),
      ALEX_NOW.toISOString(),
    );
    expect(audit.event_sequence.map((e) => e.event)).toEqual([
      "draft_created",
      "escalation_cleared",
      "user_discarded",
    ]);
  });
});

describe("buildReviseTransition", () => {
  it("increments revisions_count", () => {
    const t = buildReviseTransition(freshDraft({ revisions_count: 2 }), "new body", null, ALEX_NOW);
    expect(t.revisions_count).toBe(3);
  });

  it("sets expires_at to now + 30min", () => {
    const t = buildReviseTransition(freshDraft(), "new body", null, ALEX_NOW);
    const expectedExpiry = new Date(ALEX_NOW.getTime() + REVISE_TTL_MS).toISOString();
    expect(t.expires_at).toBe(expectedExpiry);
  });

  it("sets status to 'revised'", () => {
    const t = buildReviseTransition(freshDraft(), "new body", null, ALEX_NOW);
    expect(t.status).toBe("revised");
  });

  it("falls back to draft.draft_subject when newSubject is null", () => {
    const t = buildReviseTransition(
      freshDraft({ draft_subject: "Original Subject" }),
      "new body",
      null,
      ALEX_NOW,
    );
    expect(t.draft_subject).toBe("Original Subject");
  });

  it("uses newSubject when provided", () => {
    const t = buildReviseTransition(
      freshDraft({ draft_subject: "Original" }),
      "new body",
      "Updated Subject",
      ALEX_NOW,
    );
    expect(t.draft_subject).toBe("Updated Subject");
  });

  it("with escalation, audit ordering is [escalation_acknowledged, user_revised]", () => {
    const t = buildReviseTransition(
      freshDraft({ escalation_flag: "agent_followup" }),
      "new body",
      null,
      ALEX_NOW,
    );
    expect(t.audit_log.event_sequence).toHaveLength(2);
    expect(t.audit_log.event_sequence[0].event).toBe("escalation_acknowledged");
    expect(t.audit_log.event_sequence[0].action).toBe("revise");
    expect(t.audit_log.event_sequence[1].event).toBe("user_revised");
    expect(t.audit_log.event_sequence[1].revisions_count_after).toBe(1);
  });

  it("user_revised event captures previous body and subject", () => {
    const t = buildReviseTransition(
      freshDraft({ draft_body_plain: "old body", draft_subject: "old subject" }),
      "new body",
      "new subject",
      ALEX_NOW,
    );
    const reviseEvent = t.audit_log.event_sequence[0];
    expect(reviseEvent.previous_body).toBe("old body");
    expect(reviseEvent.previous_subject).toBe("old subject");
  });
});

describe("buildApprovedAudit", () => {
  it("send_now with no escalation: events = [user_approved{action:send_now}]", () => {
    const audit = buildApprovedAudit(freshDraft(), "send_now", ALEX_NOW.toISOString());
    expect(audit.event_sequence).toHaveLength(1);
    expect(audit.event_sequence[0].event).toBe("user_approved");
    expect(audit.event_sequence[0].action).toBe("send_now");
  });

  it("send_now with escalation_flag='agent_followup': prepends escalation_acknowledged", () => {
    const audit = buildApprovedAudit(
      freshDraft({ escalation_flag: "agent_followup" }),
      "send_now",
      ALEX_NOW.toISOString(),
    );
    expect(audit.event_sequence).toHaveLength(2);
    expect(audit.event_sequence[0].event).toBe("escalation_acknowledged");
    expect(audit.event_sequence[0].action).toBe("send_now");
    expect(audit.event_sequence[1].event).toBe("user_approved");
  });

  it("create_gmail_draft tags action correctly", () => {
    const audit = buildApprovedAudit(freshDraft(), "create_gmail_draft", ALEX_NOW.toISOString());
    expect(audit.event_sequence[0].action).toBe("create_gmail_draft");
  });
});

describe("send + Gmail audit builders", () => {
  it("buildSentAudit appends sent_via_resend with message_id", () => {
    const approved = buildApprovedAudit(freshDraft(), "send_now", ALEX_NOW.toISOString());
    const sent = buildSentAudit(approved, ALEX_NOW.toISOString(), {
      messageId: "msg_123",
      originalTo: "agent@example.com",
      redirectedTo: "alex@alexhollienco.com",
    });
    const last = sent.event_sequence[sent.event_sequence.length - 1];
    expect(last.event).toBe("sent_via_resend");
    expect(last.message_id).toBe("msg_123");
    expect(last.redirected_to).toBe("alex@alexhollienco.com");
  });

  it("buildSendFailAudit appends send_failed with error", () => {
    const approved = buildApprovedAudit(freshDraft(), "send_now", ALEX_NOW.toISOString());
    const failed = buildSendFailAudit(approved, "API key invalid");
    const last = failed.event_sequence[failed.event_sequence.length - 1];
    expect(last.event).toBe("send_failed");
    expect(last.error).toBe("API key invalid");
  });

  it("buildMarkReadAudit appends original_email_marked_read", () => {
    const approved = buildApprovedAudit(freshDraft(), "send_now", ALEX_NOW.toISOString());
    const sent = buildSentAudit(approved, ALEX_NOW.toISOString(), {
      messageId: "x",
      originalTo: "y@z.com",
    });
    const final = buildMarkReadAudit(sent, "gmail_abc");
    const last = final.event_sequence[final.event_sequence.length - 1];
    expect(last.event).toBe("original_email_marked_read");
    expect(last.gmail_id).toBe("gmail_abc");
  });

  it("buildGmailDraftFailAudit appends gmail_draft_failed", () => {
    const approved = buildApprovedAudit(
      freshDraft(),
      "create_gmail_draft",
      ALEX_NOW.toISOString(),
    );
    const failed = buildGmailDraftFailAudit(approved, "OAuth expired");
    const last = failed.event_sequence[failed.event_sequence.length - 1];
    expect(last.event).toBe("gmail_draft_failed");
    expect(last.error).toBe("OAuth expired");
  });

  it("buildGmailDraftAudit appends sent_via_gmail_draft", () => {
    const approved = buildApprovedAudit(
      freshDraft(),
      "create_gmail_draft",
      ALEX_NOW.toISOString(),
    );
    const sent = buildGmailDraftAudit(approved, ALEX_NOW.toISOString(), {
      draftId: "draft_x",
      messageId: "msg_y",
    });
    const last = sent.event_sequence[sent.event_sequence.length - 1];
    expect(last.event).toBe("sent_via_gmail_draft");
    expect(last.gmail_draft_id).toBe("draft_x");
    expect(last.gmail_message_id).toBe("msg_y");
  });
});

describe("Full lifecycle ordering -- send_now with escalation", () => {
  it("escalated send_now success produces [escalation_acknowledged, user_approved, sent_via_resend, original_email_marked_read]", () => {
    const ts = ALEX_NOW.toISOString();
    const draft = freshDraft({ escalation_flag: "marlene" });
    const approved = buildApprovedAudit(draft, "send_now", ts);
    const sent = buildSentAudit(approved, ts, {
      messageId: "m1",
      originalTo: "a@b.com",
    });
    const final = buildMarkReadAudit(sent, "gmail_id_1");
    expect(final.event_sequence.map((e) => e.event)).toEqual([
      "escalation_acknowledged",
      "user_approved",
      "sent_via_resend",
      "original_email_marked_read",
    ]);
  });

  it("escalated discard produces [escalation_cleared, user_discarded]", () => {
    const audit = buildDiscardAudit(
      freshDraft({ escalation_flag: "agent_followup" }),
      ALEX_NOW.toISOString(),
    );
    expect(audit.event_sequence.map((e) => e.event)).toEqual([
      "escalation_cleared",
      "user_discarded",
    ]);
  });
});

describe("htmlToPlain", () => {
  it("strips simple tags", () => {
    expect(htmlToPlain("<p>hello</p>")).toBe("hello");
  });

  it("converts <br> to newline", () => {
    expect(htmlToPlain("a<br>b<br/>c")).toBe("a\nb\nc");
  });

  it("decodes basic HTML entities (trailing whitespace trimmed)", () => {
    // &nbsp; becomes space, then .trim() removes trailing whitespace.
    expect(htmlToPlain("&amp;&lt;&gt;&quot;&nbsp;")).toBe('&<>"');
  });

  it("preserves &nbsp; converted to space when not trailing", () => {
    expect(htmlToPlain("a&nbsp;b")).toBe("a b");
  });

  it("collapses 3+ newlines to 2", () => {
    expect(htmlToPlain("<p>a</p><p>b</p>")).toBe("a\n\nb");
  });

  it("trims leading and trailing whitespace", () => {
    expect(htmlToPlain("  <p>x</p>  ")).toBe("x");
  });
});
