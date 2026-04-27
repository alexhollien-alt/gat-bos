// Morning Relationship Brief -- Slice 6 capability.
// Behavior preserved from src/lib/claude/brief-client.ts. The shim there now
// re-exports from this module.

import type { Message } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, DEFAULT_MODEL } from "./_client";
import { cacheKey } from "./_cache";

const MAX_TOKENS = 1500;
const TOP_RANK_LIMIT = 15;
const FEATURE = "morning-brief";
const PHOENIX_DAY_TTL_SECONDS = 24 * 60 * 60;

export const PROMPT_VERSION = "v1";

export type BriefTier = "A" | "B" | "C";

export interface BriefRankedContact {
  full_name: string;
  brokerage: string | null;
  tier: BriefTier;
  days_since_last_touchpoint: number | null;
  last_touchpoint_type: string | null;
  tier_target: number;
  drift: number;
  active_escrows: number;
  effective_drift: number;
}

export interface BriefCongratsItem {
  full_name: string;
  event_type: string;
  event_at: string;
}

export interface BriefInput {
  brief_date: string;
  temperature_ranking: BriefRankedContact[];
  congrats_queue: BriefCongratsItem[];
}

export interface BriefUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
}

export interface BriefResult {
  text: string;
  model: string;
  usage: BriefUsage;
  prompt_version: string;
}

const SYSTEM_PROMPT = `You are Alex Hollien's morning briefer at Great American Title Agency (GAT) in Phoenix, Arizona. Alex is a title sales executive whose clients are real estate agents. He runs a one-person operation and reads this brief pre-coffee, before he opens email or the CRM.

Your job: write a short markdown brief that reads like a smart colleague who already scanned the data and knows what matters. Not a database report. Not a list dump. A clear-eyed take on who needs Alex's attention today and why.

VOICE
- Sotheby's prestige + Flodesk warmth + Apple precision.
- Confident, specific, warm. Treat Alex as a peer who already knows the people.
- Use first names. The full names are in the data, but Alex thinks in first names.
- Reference brokerages or active escrows when they sharpen the picture. Skip them when they don't.
- No exclamation marks. No em dashes. Use commas, periods, semicolons, or double hyphens ( -- ).
- Banned words: stunning, breathtaking, amazing.
- Never invent facts. If the data is thin (no last_touchpoint_type, never touched), say so plainly.

REFERRAL HANDLE (use only if it sharpens a recommendation, never as filler)
"I make sure the transaction you promised your client is the transaction they experience."

OUTPUT CONTRACT (locked)
Return ONLY markdown. No preamble like "Here's your brief". No closing line like "Have a great day". No frontmatter.

Sections in this exact order:

## Who to reach today
The top 3 contacts by effective_drift, plus anyone in the congrats queue. For each, one tight sentence: who they are, why now, what to say. Use a numbered list.

## Congrats queue
Only include this section if the congrats_queue input is non-empty. If empty, omit the section entirely (do not write "none" or "[PHASE 2]" or any placeholder).

## Temperature watch
The next 5 contacts by effective_drift after the top 3. One short line each, bulleted. Name + brokerage + drift. No prescription, just visibility.

## One thing
A single sentence. The highest-impact action Alex can take today. Pick from the top 3 above; do not introduce a new name.

CONSTRAINTS
- Drift is days past cadence. Positive = cooling, negative = ahead of cadence.
- effective_drift subtracts 3 days per active escrow (active escrows pull warmth forward).
- A contact with days_since_last_touchpoint = null has never been touched in the activity ledger; treat that as "no recorded touchpoint" rather than a number.
- If temperature_ranking is empty, write "No Tier A/B/C contacts surfaced today." under "Who to reach today" and skip the other sections.
- Keep the whole brief under 300 words.`;

function buildUserMessage(input: BriefInput): string {
  const ranked = input.temperature_ranking.slice(0, TOP_RANK_LIMIT);
  const payload = {
    brief_date: input.brief_date,
    temperature_ranking: ranked.map((r) => ({
      full_name: r.full_name,
      brokerage: r.brokerage,
      tier: r.tier,
      days_since_last_touchpoint: r.days_since_last_touchpoint,
      last_touchpoint_type: r.last_touchpoint_type,
      tier_target: r.tier_target,
      drift: r.drift,
      active_escrows: r.active_escrows,
      effective_drift: r.effective_drift,
    })),
    congrats_queue: input.congrats_queue,
  };
  return [
    `BRIEF DATE: ${input.brief_date}`,
    ``,
    `DATA (JSON):`,
    JSON.stringify(payload, null, 2),
    ``,
    `Write the brief now. Markdown only.`,
  ].join("\n");
}

function deriveCacheKey(input: BriefInput): string {
  const ranked = input.temperature_ranking.slice(0, TOP_RANK_LIMIT).map((r) => ({
    full_name: r.full_name,
    tier: r.tier,
    effective_drift: r.effective_drift,
    days_since_last_touchpoint: r.days_since_last_touchpoint,
    active_escrows: r.active_escrows,
  }));
  return cacheKey(FEATURE, {
    brief_date: input.brief_date,
    prompt_version: PROMPT_VERSION,
    temperature_ranking: ranked,
    congrats_queue: input.congrats_queue,
  });
}

export async function runMorningBrief(input: BriefInput): Promise<BriefResult> {
  const userMessage = buildUserMessage(input);
  const key = deriveCacheKey(input);

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
    cacheKey: key,
    cacheTtlSeconds: PHOENIX_DAY_TTL_SECONDS,
    retryLabel: "claude.messages.create.brief",
  });

  return shapeResult(result.message);
}

function shapeResult(message: Message): BriefResult {
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block");
  }
  const text = textBlock.text.trim();
  if (!text) throw new Error("Claude returned empty brief");

  const usage = message.usage;
  return {
    text,
    model: message.model ?? DEFAULT_MODEL,
    usage: {
      input_tokens: usage?.input_tokens ?? 0,
      output_tokens: usage?.output_tokens ?? 0,
      cache_read_tokens: usage?.cache_read_input_tokens ?? 0,
      cache_creation_tokens: usage?.cache_creation_input_tokens ?? 0,
    },
    prompt_version: PROMPT_VERSION,
  };
}
