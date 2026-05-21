// Type inference for /api/captures target=task_system.
//
// Mirrors src/lib/ai/morning-brief.ts pattern: callClaude with budget guard,
// ai_usage_log writes, retry. Uses claude-haiku-4-5-20251001 as a cheap
// classifier. If inference fails (Claude error or unparseable response), the
// caller falls back to type='task' status='inbox' and emits a warning.

import { callClaude } from "@/lib/ai/_client";
import type { NodeType } from "@/lib/types/task-system";

const FEATURE = "task-system.infer-type";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 100;

const ALLOWED_TYPES: readonly NodeType[] = [
  "task",
  "project",
  "area",
  "contact",
  "interaction",
  "event",
];

const SYSTEM_PROMPT = `You classify short raw text into one of six task-system types for Alex Hollien at Great American Title Agency in Phoenix. Alex is a title sales executive whose clients are real estate agents.

The six types:
- task: a single next physical action (verb-driven, completable in one sitting)
- project: work with a defined end state and deadline (multi-step, ships)
- area: an ongoing responsibility, no end state (e.g. Sales Production, Agent Partnerships)
- contact: a person (agent, lender, escrow officer, vendor, sphere)
- interaction: a touchpoint that already happened (call, text, coffee, broker open)
- event: an immutable log entry of work shipped or a transaction milestone

Respond with exactly one word: the type name. No explanation, no punctuation, no quotes. If ambiguous, choose "task".`;

export interface InferTypeInput {
  rawText: string;
  userId: string;
}

export interface InferTypeResult {
  type: NodeType;
  fallback: boolean;
  summary: string | null;
}

export async function inferType(input: InferTypeInput): Promise<InferTypeResult> {
  const { rawText, userId } = input;

  let response;
  try {
    response = await callClaude({
      feature: FEATURE,
      userId,
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: rawText.slice(0, 1500),
        },
      ],
    });
  } catch {
    return { type: "task", fallback: true, summary: null };
  }

  const block = response.message.content?.[0];
  const text = block && block.type === "text" ? block.text.trim().toLowerCase() : "";
  const candidate = text.replace(/[^a-z]/g, "");

  const matched = ALLOWED_TYPES.find((t) => t === candidate);
  if (!matched) {
    return { type: "task", fallback: true, summary: null };
  }

  return {
    type: matched,
    fallback: false,
    summary: deriveSummary(rawText),
  };
}

function deriveSummary(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 120) return trimmed;
  return trimmed.slice(0, 117) + "...";
}
