// Email draft generation -- Slice 6 capability.
// Behavior preserved from src/lib/claude/draft-client.ts. The shim there now
// re-exports from this module.
//
// Naming note: the starter calls this "draft-revise" (the longer-term plan is a
// revise endpoint built on the same plumbing). For now this is the single
// generateDraft entry; a reviseDraft path will land in a follow-up slice.

import type { Message } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, DEFAULT_MODEL } from "./_client";

const MAX_TOKENS = 800;
const FEATURE = "draft-revise";

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

export async function generateDraft(
  email: DraftEmailInput,
  context: DraftContext,
): Promise<DraftResult> {
  const userMessage = buildUserMessage(email, context);

  const result = await callClaude({
    feature: FEATURE,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
    max_tokens: MAX_TOKENS,
    retryLabel: "claude.messages.create",
  });

  return shapeResult(result.message, email.subject);
}

function shapeResult(message: Message, originalSubject: string): DraftResult {
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block");
  }
  const bodyText = textBlock.text.trim();
  if (!bodyText) throw new Error("Claude returned empty body");

  const usage = message.usage;
  return {
    subject: buildSubject(originalSubject),
    body: bodyText,
    model: message.model ?? DEFAULT_MODEL,
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    cache_read_tokens: usage?.cache_read_input_tokens ?? 0,
    cache_creation_tokens: usage?.cache_creation_input_tokens ?? 0,
    prompt_version: PROMPT_VERSION,
  };
}

// Public alias for the planned reviseDraft entry point. v1 just wraps
// generateDraft so callers can adopt the new name; the actual revise prompt
// path lands in a follow-up slice.
export const reviseDraft = generateDraft;
