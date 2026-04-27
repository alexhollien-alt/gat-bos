// Slice 6 shim. AI generation moved to src/lib/ai/draft-revise.ts.
// Non-AI helpers (HTML wrap, escalation detection) stay here -- they don't
// pass through the consolidated AI layer. Schedule shim deletion in Slice 7
// (see LATER.md).

export {
  PROMPT_VERSION,
  generateDraft,
  reviseDraft,
  type SenderTier,
  type DraftEmailInput,
  type DraftContext,
  type DraftResult,
} from "@/lib/ai/draft-revise";

// Regex-based escalation flag detection. Runs on inbound email + generated draft.
const MARLENE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bescrow\b/i, label: "escrow" },
  {
    pattern: /\bclosing\b[^.?!]{0,80}?\b(date|ready|sign)\b/i,
    label: "closing + date/ready/sign",
  },
  { pattern: /\btitle\s+issue\b/i, label: "title issue" },
  { pattern: /\blien\b/i, label: "lien" },
  { pattern: /\bsurvey\b/i, label: "survey" },
  { pattern: /\bappraisal\b/i, label: "appraisal" },
  { pattern: /\bunderwriting\b/i, label: "underwriting" },
  { pattern: /\bclear\s+to\s+close\b/i, label: "clear to close" },
  { pattern: /\bwire\s+instructions\b/i, label: "wire instructions" },
  { pattern: /\bfinal\s+walk\s*through\b/i, label: "final walkthrough" },
];

const AGENT_FOLLOWUP_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\binterested\s+in\s+working\s+with\s+you\b/i, label: "interested in working with you" },
  { pattern: /\blooking\s+for\s+(a\s+)?title\s+partner\b/i, label: "looking for title partner" },
  { pattern: /\bnew\s+agent\b/i, label: "new agent" },
  { pattern: /\breferral\s+partner\b/i, label: "referral partner" },
  { pattern: /\bpartnership\s+opportunity\b/i, label: "partnership opportunity" },
  {
    pattern: /\bhome\s+tour\b[^.?!]{0,80}?\bavailable\b/i,
    label: "home tour + available",
  },
];

export interface EscalationDetection {
  flag: "marlene" | "agent_followup" | null;
  reason: string | null;
  matched_labels: string[];
}

// Black token from brand.md (Kit 1 email default body color).
const BODY_COLOR = "#0a0a0a";

export function wrapReplyHtml(plain: string): string {
  const escaped = plain
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  const style = [
    "font-family: Inter, -apple-system, Helvetica, Arial, sans-serif",
    "font-size: 14px",
    "line-height: 1.55",
    "color: " + BODY_COLOR,
  ].join("; ");
  return `<div style="${style}">${paragraphs}</div>`;
}

export function detectEscalation(
  inboundSubject: string,
  inboundBody: string,
  draftBody: string,
): EscalationDetection {
  const haystack = `${inboundSubject}\n${inboundBody}\n${draftBody}`;

  const marleneHits = MARLENE_PATTERNS.filter((p) => p.pattern.test(haystack)).map(
    (p) => p.label,
  );
  if (marleneHits.length > 0) {
    return {
      flag: "marlene",
      reason: `Escrow/closing keywords matched: ${marleneHits.join(", ")}`,
      matched_labels: marleneHits,
    };
  }

  const followupHits = AGENT_FOLLOWUP_PATTERNS.filter((p) =>
    p.pattern.test(haystack),
  ).map((p) => p.label);
  if (followupHits.length > 0) {
    return {
      flag: "agent_followup",
      reason: `New agent prospect keywords matched: ${followupHits.join(", ")}`,
      matched_labels: followupHits,
    };
  }

  return { flag: null, reason: null, matched_labels: [] };
}
