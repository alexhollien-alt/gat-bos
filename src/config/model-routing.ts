// src/config/model-routing.ts
// Feature-to-model routing map for the Anthropic Adviser Strategy.
// Each feature key defines which executor model handles the request and
// how many times the adviser (Opus) can be consulted.

import type { FeatureKey, ModelRoutingEntry } from "@/lib/ai/types";

export const MODEL_ROUTING: Record<FeatureKey, ModelRoutingEntry> = {
  voiceMemo: {
    executor: "claude-haiku-4-5",
    adviserMaxUses: 1,
    description:
      "Voice memo transcription and contact note extraction",
  },
  emailGeneration: {
    executor: "claude-sonnet-4-6",
    adviserMaxUses: 2,
    description:
      "Email content generation for Weekly Edge, Closing Brief, onboarding sequences",
  },
  agentStrategy: {
    executor: "claude-sonnet-4-6",
    adviserMaxUses: 3,
    description:
      "Agent strategy session summaries and action plan generation",
  },
  morningBriefing: {
    executor: "claude-haiku-4-5",
    adviserMaxUses: 1,
    description: "Daily morning briefing generation",
  },
  contactClassification: {
    executor: "claude-haiku-4-5",
    adviserMaxUses: 0,
    description: "CRM contact tier classification (A/B/C/P)",
  },
  marketIntelligence: {
    executor: "claude-sonnet-4-6",
    adviserMaxUses: 2,
    description:
      "Market data interpretation and agent-facing narrative",
  },
  general: {
    executor: "claude-sonnet-4-6",
    adviserMaxUses: 2,
    description: "Default fallback for unspecified features",
  },
} as const;

/**
 * Cost per million tokens by model. Used for usage cost estimation.
 * Source: Anthropic pricing as of 2026-04-11.
 */
export const COST_PER_MTK: Record<
  string,
  { input: number; output: number }
> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-6": { input: 5.0, output: 25.0 },
};

/**
 * Estimated tokens per adviser call. The API does not break out
 * per-model token usage, so we use Anthropic's documented typical
 * range (~1,400 tokens) for cost estimation.
 */
export const ESTIMATED_ADVISER_TOKENS_PER_CALL = 1400;
