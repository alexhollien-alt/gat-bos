// Weekly Edge market-narrative writer -- Slice 8 Phase 3 capability.
// Consumes one weekly_snapshot row and produces the four narrative fields
// the assembler drops into the weekly-edge Handlebars template.
//
// Mirrors src/lib/ai/morning-brief.ts: callClaude wrapper for budget guard,
// ai_cache, and ai_usage_log; SYSTEM_PROMPT carries the voice + contract.
// Differs in two places:
//   1. Output contract is JSON, not markdown. Claude is asked to return a
//      single JSON object; parseAndValidate() is the post-process gate.
//   2. Pending-credentials short-circuit: when data.status is
//      'pending_credentials' (Phase 2 fallback before Altos onboarding),
//      no Claude call fires. A placeholder result surfaces in the rendered
//      draft and the reviewer rejects it in /drafts before send.

import type { Message } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, DEFAULT_MODEL } from "./_client";
import { cacheKey } from "./_cache";

const MAX_TOKENS = 1500;
const FEATURE = "weekly-edge-writer";
const ONE_DAY_TTL_SECONDS = 24 * 60 * 60;

export const PROMPT_VERSION = "v1";

export const BANNED_WORDS = ["stunning", "breathtaking", "amazing"] as const;

export interface WeeklySnapshotRow {
  week_of: string;            // ISO date, Monday of the week
  market_slug: string;        // e.g. "scottsdale-85258-sf"
  market_label: string;       // e.g. "Scottsdale 85258 single-family"
  data: Record<string, unknown>;
  narrative_seed: string | null;
}

export interface WeeklyEdgeWriterInput {
  snapshot: WeeklySnapshotRow;
  userId: string;
}

export interface DataCallout {
  label: string;
  value: string;
  delta: string;
}

export interface WeeklyEdgeNarrative {
  headline: string;
  market_block: string;
  data_callouts: DataCallout[];
  closing: string;
}

export interface WeeklyEdgeWriterUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
}

export interface WeeklyEdgeWriterResult {
  narrative: WeeklyEdgeNarrative;
  model: string;
  usage: WeeklyEdgeWriterUsage;
  prompt_version: string;
  pending_credentials: boolean;
}

const SYSTEM_PROMPT = `You are Alex Hollien's market-narrative writer at Great American Title Agency (GAT) in Phoenix, Arizona. Alex is a title sales executive whose clients are real estate agents. This narrative ships in the Weekly Edge email that goes out every Tuesday to Alex's agent list.

Your job: turn one week of market data into a tight, readable narrative the agents will actually use with their clients. Not a stat dump. A clear-eyed read on what changed, what it means, and how an agent would talk about it.

VOICE
- Sotheby's prestige + Flodesk warmth + Apple precision.
- Confident, specific, never breathless.
- Treat the reader as a working professional. Skip throat-clearing.
- No exclamation marks. No em dashes. Use commas, periods, semicolons, or double hyphens ( -- ).
- Banned words: stunning, breathtaking, amazing.
- Never invent numbers. If a field is missing from the data, work around it. Do not fabricate.

OUTPUT CONTRACT (locked)
Return ONLY a single JSON object. No preamble, no closing, no markdown fences. The object must have exactly these four keys:

{
  "headline": string,           // 70 chars max. Specific to the market and the week. No exclamation marks.
  "market_block": string,       // 2 to 3 short paragraphs. The narrative core. What changed, why it matters.
  "data_callouts": [            // 3 to 5 stat tiles, ordered most to least notable
    { "label": string, "value": string, "delta": string }
  ],
  "closing": string             // 1 paragraph. Warm, forward-looking, agent-actionable.
}

CONSTRAINTS
- "delta" in each callout is a short string like "+2.3%", "-4 days", "flat WoW". Empty string is acceptable when delta is unknown; never invent.
- "value" is the headline figure: "$725,000", "38 days", "1.4 months supply".
- If narrative_seed is provided in the input, weave it into the market_block as the lead.
- Keep market_block under 180 words. Keep closing under 60 words.`;

function buildUserMessage(snapshot: WeeklySnapshotRow): string {
  return [
    `WEEK OF: ${snapshot.week_of}`,
    `MARKET: ${snapshot.market_label} (${snapshot.market_slug})`,
    snapshot.narrative_seed
      ? `NARRATIVE SEED (lead with this): ${snapshot.narrative_seed}`
      : `NARRATIVE SEED: (none)`,
    ``,
    `DATA (JSON):`,
    JSON.stringify(snapshot.data, null, 2),
    ``,
    `Write the JSON object now. JSON only.`,
  ].join("\n");
}

function deriveCacheKey(snapshot: WeeklySnapshotRow): string {
  return cacheKey(FEATURE, {
    prompt_version: PROMPT_VERSION,
    week_of: snapshot.week_of,
    market_slug: snapshot.market_slug,
    narrative_seed: snapshot.narrative_seed,
    data: snapshot.data,
  });
}

const PENDING_CREDENTIALS_NARRATIVE: WeeklyEdgeNarrative = {
  headline: "PLACEHOLDER: Altos credentials pending",
  market_block:
    "PLACEHOLDER: This week's market data has not been pulled yet. The Altos integration is awaiting credentials. Reject this draft in the review queue; the next pull will populate real numbers.",
  data_callouts: [
    { label: "Status", value: "pending_credentials", delta: "" },
  ],
  closing:
    "PLACEHOLDER: Once Altos is wired, this paragraph will close the email.",
};

export async function runWeeklyEdgeWriter(
  input: WeeklyEdgeWriterInput,
): Promise<WeeklyEdgeWriterResult> {
  const { snapshot } = input;

  // Phase 2 fallback: surface pending-credentials state to the human reviewer.
  if (snapshot.data && (snapshot.data as { status?: unknown }).status === "pending_credentials") {
    return {
      narrative: PENDING_CREDENTIALS_NARRATIVE,
      model: DEFAULT_MODEL,
      usage: zeroUsage(),
      prompt_version: PROMPT_VERSION,
      pending_credentials: true,
    };
  }

  const userMessage = buildUserMessage(snapshot);
  const key = deriveCacheKey(snapshot);

  const result = await callClaude({
    feature: FEATURE,
    userId: input.userId,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
    max_tokens: MAX_TOKENS,
    cacheKey: key,
    cacheTtlSeconds: ONE_DAY_TTL_SECONDS,
    retryLabel: "claude.messages.create.weekly-edge-writer",
  });

  return shapeResult(result.message);
}

function shapeResult(message: Message): WeeklyEdgeWriterResult {
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block for weekly-edge-writer");
  }
  const raw = textBlock.text.trim();
  if (!raw) throw new Error("Claude returned empty narrative");

  const parsed = parseJsonObject(raw);
  const narrative = normalizeAndValidate(parsed);

  const usage = message.usage;
  return {
    narrative,
    model: message.model ?? DEFAULT_MODEL,
    usage: {
      input_tokens: usage?.input_tokens ?? 0,
      output_tokens: usage?.output_tokens ?? 0,
      cache_read_tokens: usage?.cache_read_input_tokens ?? 0,
      cache_creation_tokens: usage?.cache_creation_input_tokens ?? 0,
    },
    prompt_version: PROMPT_VERSION,
    pending_credentials: false,
  };
}

// Extract the first balanced JSON object from a string. Tolerates a stray code
// fence or preamble even though the system prompt forbids them.
function parseJsonObject(raw: string): unknown {
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("weekly-edge-writer: no JSON object in response");
  }
  const slice = stripped.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (err) {
    throw new Error(
      `weekly-edge-writer: response is not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

// Validate structure, auto-fix em dashes, throw on banned words / exclamation marks.
// Auto-fix is appropriate for em dashes because the substitution is mechanical.
// Banned words and exclamation marks throw because they require rephrasing.
export function normalizeAndValidate(value: unknown): WeeklyEdgeNarrative {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("weekly-edge-writer: response is not an object");
  }
  const obj = value as Record<string, unknown>;

  const headline = requireString(obj, "headline");
  const marketBlock = requireString(obj, "market_block");
  const closing = requireString(obj, "closing");
  const callouts = requireCallouts(obj.data_callouts);

  if (headline.length > 70) {
    throw new Error(
      `weekly-edge-writer: headline is ${headline.length} chars (limit 70)`,
    );
  }

  const fixedHeadline = stripEmDashes(headline);
  const fixedMarketBlock = stripEmDashes(marketBlock);
  const fixedClosing = stripEmDashes(closing);
  const fixedCallouts = callouts.map((c) => ({
    label: stripEmDashes(c.label),
    value: stripEmDashes(c.value),
    delta: stripEmDashes(c.delta),
  }));

  for (const [field, text] of [
    ["headline", fixedHeadline],
    ["market_block", fixedMarketBlock],
    ["closing", fixedClosing],
  ] as const) {
    assertNoBannedContent(field, text);
  }
  for (const c of fixedCallouts) {
    assertNoBannedContent("data_callouts.label", c.label);
    assertNoBannedContent("data_callouts.value", c.value);
    assertNoBannedContent("data_callouts.delta", c.delta);
  }

  return {
    headline: fixedHeadline,
    market_block: fixedMarketBlock,
    data_callouts: fixedCallouts,
    closing: fixedClosing,
  };
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string") {
    throw new Error(`weekly-edge-writer: missing or non-string field "${key}"`);
  }
  const trimmed = v.trim();
  if (!trimmed) {
    throw new Error(`weekly-edge-writer: field "${key}" is empty`);
  }
  return trimmed;
}

function requireCallouts(value: unknown): DataCallout[] {
  if (!Array.isArray(value)) {
    throw new Error("weekly-edge-writer: data_callouts must be an array");
  }
  if (value.length < 3 || value.length > 5) {
    throw new Error(
      `weekly-edge-writer: data_callouts must have 3 to 5 entries (got ${value.length})`,
    );
  }
  return value.map((entry, idx) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`weekly-edge-writer: data_callouts[${idx}] is not an object`);
    }
    const obj = entry as Record<string, unknown>;
    const label = requireString(obj, "label");
    const value = requireString(obj, "value");
    const deltaRaw = obj.delta;
    if (typeof deltaRaw !== "string") {
      throw new Error(
        `weekly-edge-writer: data_callouts[${idx}].delta must be a string`,
      );
    }
    return { label, value, delta: deltaRaw };
  });
}

// U+2014 (em) / U+2013 (en) replaced with " -- " per Standing Rule 2.
// Unicode escapes keep the literal glyphs out of source so the em-dash hook
// stays clean.
const DASH_RE = new RegExp("\\s*[\\u2013\\u2014]\\s*", "g");
function stripEmDashes(text: string): string {
  return text.replace(DASH_RE, " -- ");
}

function assertNoBannedContent(field: string, text: string): void {
  if (text.includes("!")) {
    throw new Error(`weekly-edge-writer: ${field} contains exclamation mark`);
  }
  const lower = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, "i");
    if (re.test(lower)) {
      throw new Error(`weekly-edge-writer: ${field} contains banned word "${word}"`);
    }
  }
}

function zeroUsage(): WeeklyEdgeWriterUsage {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
  };
}
