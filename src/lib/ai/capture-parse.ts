// Capture intent parser -- Slice 6 capability.
// Closes BLOCKERS.md [2026-04-21] Claude API intent parser upgrade.
//
// Wraps src/lib/captures/rules.ts as a fallback. The AI path runs only when
// CAPTURES_AI_PARSE=true (feature flag, default off). The rule parser remains
// the primary path on the live preview keystroke surface and is also the
// guaranteed fallback when AI parsing fails or is disabled.

import { callClaude } from "./_client";
import { cacheKey } from "./_cache";
import {
  parseCapture,
  type ContactIndexEntry,
  type ParseInput,
  type ParseResult,
} from "@/lib/captures/rules";
import type { ParsedIntent, CapturePayload } from "@/lib/types";

const FEATURE = "capture-parse";
const MAX_TOKENS = 400;
const CACHE_TTL_SECONDS = 24 * 60 * 60;

const VALID_INTENTS: ParsedIntent[] = [
  "follow_up",
  "ticket",
  "interaction",
  "note",
  "unprocessed",
];

const SYSTEM_PROMPT = `You are an intent parser for Alex Hollien's CRM capture box. Alex types a short note about something he just did, and you classify it into one structured intent.

INPUT
- raw_text: the note Alex typed
- contacts: a list of {id, first_name, last_name} objects -- the contacts in Alex's CRM

OUTPUT (strict)
Return ONLY a JSON object. No markdown, no preamble. Schema:
{
  "intent": "follow_up" | "ticket" | "interaction" | "note" | "unprocessed",
  "contact_id": string | null,
  "intent_keyword": string | null
}

INTENT RULES
- "follow_up": Alex wants to be reminded to reach out later ("follow up", "remind me", "check in next week").
- "ticket": Alex wants a print/design deliverable produced ("flyer", "brochure", "door hanger", "postcard", "EDDM", "ticket this", "design needed").
- "interaction": Alex is logging an event that already happened ("met with", "called", "coffee with", "spoke to", "lunch with", "texted").
- "note": A general observation tied to a contact, with no clear action ("Sara loves dogs", "Mike's wife had a baby") -- only use when contact_id is non-null.
- "unprocessed": Couldn't classify confidently. Use when the note is ambiguous AND no contact matched.

CONTACT MATCHING
- Match contacts by first_name, last_name, or full name with word-boundary semantics.
- If multiple contacts match, pick the one mentioned earliest in raw_text.
- If no contact matches, contact_id = null.

intent_keyword
- For follow_up / ticket / interaction: the literal phrase from raw_text that triggered the intent (e.g., "ticket this", "met with", "remind me"). Lowercase.
- For note / unprocessed: null.

Never invent a contact_id. Only return IDs that appear in the contacts input.`;

interface AiParserResponse {
  intent: ParsedIntent;
  contact_id: string | null;
  intent_keyword: string | null;
}

function deriveCacheKey(rawText: string, contactsIndex: ContactIndexEntry[]): string {
  // Hash the contacts list by id only -- name changes are rare and re-keying
  // on every name edit would defeat the cache.
  const contactsHash = contactsIndex
    .map((c) => c.id)
    .sort()
    .join(",");
  return cacheKey(FEATURE, {
    raw_text: rawText.trim().toLowerCase(),
    contacts: contactsHash,
  });
}

export async function parseCaptureWithAI(
  input: ParseInput,
  userId: string,
): Promise<ParseResult> {
  const ruleResult = parseCapture(input);

  let aiResponse: AiParserResponse | null = null;
  try {
    const userMessage = JSON.stringify(
      {
        raw_text: input.rawText,
        contacts: input.contactsIndex.map((c) => ({
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
        })),
      },
      null,
      2,
    );

    const result = await callClaude({
      feature: FEATURE,
      userId,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
      max_tokens: MAX_TOKENS,
      cacheKey: deriveCacheKey(input.rawText, input.contactsIndex),
      cacheTtlSeconds: CACHE_TTL_SECONDS,
    });

    const textBlock = result.message.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      aiResponse = parseAiJson(textBlock.text);
    }
  } catch (err) {
    console.error(
      "parseCaptureWithAI failed; falling back to rule parser",
      err instanceof Error ? err.message : err,
    );
  }

  if (!aiResponse) return ruleResult;

  // Merge AI output with rule result. AI wins on intent + contact when valid;
  // rule result still provides candidate_contact_ids for downstream UI.
  const intent = VALID_INTENTS.includes(aiResponse.intent)
    ? aiResponse.intent
    : ruleResult.intent;

  const contactId = isValidContactId(aiResponse.contact_id, input.contactsIndex)
    ? aiResponse.contact_id
    : ruleResult.contactId;

  const payload: CapturePayload = { ...ruleResult.payload };
  if (aiResponse.intent_keyword && typeof aiResponse.intent_keyword === "string") {
    payload.intent_keyword = aiResponse.intent_keyword;
  }

  return { intent, contactId, payload };
}

function parseAiJson(text: string): AiParserResponse | null {
  const trimmed = text.trim();
  // Strip markdown fences just in case the model wraps JSON.
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(stripped);
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      intent: (parsed.intent ?? "unprocessed") as ParsedIntent,
      contact_id:
        typeof parsed.contact_id === "string" ? parsed.contact_id : null,
      intent_keyword:
        typeof parsed.intent_keyword === "string" ? parsed.intent_keyword : null,
    };
  } catch {
    return null;
  }
}

function isValidContactId(
  id: string | null,
  contactsIndex: ContactIndexEntry[],
): id is string {
  if (!id) return false;
  return contactsIndex.some((c) => c.id === id);
}
