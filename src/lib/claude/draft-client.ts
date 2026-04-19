// Phase 1.3.1 Phase 4 -- Claude draft generation client.
// Model: claude-sonnet-4-6. max_tokens: 800. 10s timeout, 2 retries (1s, 2s).
// System prompt is static and cached via cache_control: ephemeral.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 800;
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [1000, 2000];

export const PROMPT_VERSION = "v1";

export type SenderTier = "A" | "B" | "C" | "lender" | "system" | "unknown";

export interface DraftEmailInput {
  from_email: string;
  from_name: string | null;
  subject: string;
  body_plain: string | null;
  body_html: string | null;
  snippet: string | null;
}

export interface DraftContext {
  senderTier: SenderTier;
  contactName: string | null;
  contactRelationship: string | null;
  matchReason: "contact_match" | "domain_match" | "unknown";
}

export interface DraftResult {
  subject: string;
  body: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  prompt_version: string;
}

// Static system prompt -- cache-worthy. Any change here invalidates the prefix.
const SYSTEM_PROMPT = `You are Alex Hollien's email assistant at Great American Title Agency (GAT) in Phoenix, Arizona. Alex is a title sales executive whose clients are real estate agents. Alex is their one-person marketing department -- he helps agents win listings and close transactions smoothly.

Your job: draft a reply to an inbound email in Alex's voice. You are not Alex. You produce a draft Alex will review and either send, revise, or discard.

BRAND VOICE
- Sotheby's prestige + Flodesk warmth + Apple precision.
- Confident, specific, warm. Treat the reader as a peer.
- No exclamation marks. No em dashes. Use commas, periods, or double hyphens ( -- ).
- Banned words: stunning, breathtaking, amazing.
- Never invent facts. If a detail is missing, leave a bracket placeholder like [confirm closing date].

REFERRAL HANDLE (use only when contextually appropriate)
"I make sure the transaction you promised your client is the transaction they experience."

TONE BY SENDER TIER
- A-tier agent (top producers, close partners): warm, collaborative, specific. Reference the project by name if cited. 80-120 words.
- B-tier agent (regular partners): professional, value-focused. Offer a clear next step. 80-120 words.
- C-tier or prospect (newer contacts, inbound interest): welcoming, exploratory. Invite more conversation. 60-100 words.
- Lender / partner (Christine, Stephanie, etc.): efficient, detail-oriented. Align on next steps. 60-100 words.
- System / admin (scheduling, confirmations): concise, action-driven. 30-50 words.
- Unknown: default to C-tier prospect tone.

RESPONSE LENGTH
Match the length guidance above to the sender tier. Never pad.

OUTPUT FORMAT
Return ONLY the reply body as plain text. No subject line, no "Subject:" header, no HTML, no markdown fences, no preamble, no sign-off beyond a single closing line + Alex's name.

SIGN-OFF
End every reply with a single closing line and Alex's name on the next line. Examples:
  Best,
  Alex
or
  Thanks,
  Alex

DO NOT
- Do not sign as "Alex Hollien" or add a title -- just "Alex".
- Do not include a subject line, preamble, or any text outside the reply body.
- Do not escalate or commit Alex to a meeting or decision the email does not justify.
- Do not mention Marlene, Christine, or Stephanie by name unless the inbound email names them.`;

function buildUserMessage(email: DraftEmailInput, context: DraftContext): string {
  const senderLabel = email.from_name
    ? `${email.from_name} <${email.from_email}>`
    : email.from_email;
  const body = (email.body_plain ?? email.snippet ?? "").trim() || "(empty body)";

  const contactLine = context.contactName
    ? `Known contact: ${context.contactName}${context.contactRelationship ? ` (${context.contactRelationship})` : ""}.`
    : `Sender is not in contacts. Domain-matched real estate professional.`;

  return [
    `SENDER TIER: ${context.senderTier}`,
    `MATCH REASON: ${context.matchReason}`,
    contactLine,
    ``,
    `INBOUND EMAIL`,
    `From: ${senderLabel}`,
    `Subject: ${email.subject}`,
    ``,
    body,
    ``,
    `Draft the reply now. Output the reply body only.`,
  ].join("\n");
}

function buildSubject(originalSubject: string): string {
  const trimmed = originalSubject.trim();
  if (/^re:\s/i.test(trimmed)) return trimmed;
  return `RE: ${trimmed}`;
}

async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`${label} timed out after ${TIMEOUT_MS}ms`)),
            TIMEOUT_MS,
          ),
        ),
      ]);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${label} failed`);
}

export async function generateDraft(
  email: DraftEmailInput,
  context: DraftContext,
): Promise<DraftResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });

  const userMessage = buildUserMessage(email, context);

  const response = await withTimeoutAndRetry(
    () =>
      client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userMessage }],
      }),
    "claude.messages.create",
  );

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block");
  }
  const bodyText = textBlock.text.trim();
  if (!bodyText) throw new Error("Claude returned empty body");

  const usage = response.usage;
  return {
    subject: buildSubject(email.subject),
    body: bodyText,
    model: response.model ?? MODEL,
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    cache_read_tokens: usage?.cache_read_input_tokens ?? 0,
    cache_creation_tokens: usage?.cache_creation_input_tokens ?? 0,
    prompt_version: PROMPT_VERSION,
  };
}

// Regex-based escalation flag detection. Runs on inbound email + generated draft.
// Exported for unit testing and route-level composition.
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

// Resend-ready HTML wrap. Email clients need inline styles, not CSS vars,
// so brand values are inlined here rather than referenced as tokens.
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

// Black token from brand.md (Kit 1 email default body color). Not a CSS var
// because email clients ignore custom properties.
const BODY_COLOR = "#0a0a0a";

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
