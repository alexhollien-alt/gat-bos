// src/lib/ai/types.ts
// TypeScript types for the Anthropic Adviser Strategy layer.
// The adviser tool lets cheaper executor models (Haiku/Sonnet) call a smarter
// adviser model (Opus) on-demand during complex reasoning.

import type Anthropic from "@anthropic-ai/sdk";

/** Feature keys that map to model routing configurations. */
export type FeatureKey =
  | "voiceMemo"
  | "emailGeneration"
  | "agentStrategy"
  | "morningBriefing"
  | "contactClassification"
  | "marketIntelligence"
  | "general";

/** Per-feature routing config: which executor model to use and how many adviser calls to allow. */
export interface ModelRoutingEntry {
  executor: string;
  adviserMaxUses: number;
  description: string;
}

/** Input options for createAdvisedCompletion(). */
export interface AdvisedCompletionOptions {
  featureKey: FeatureKey;
  system: string;
  messages: Anthropic.MessageParam[];
  /** Additional tools to include alongside the adviser tool. */
  tools?: Anthropic.Tool[];
  /** Defaults to 16000. */
  maxTokens?: number;
  /** Required for usage logging. Pass the authenticated user's UUID. */
  userId?: string;
}

/** Result returned by createAdvisedCompletion(). */
export interface AdvisedCompletionResult {
  /** Extracted text content from the response. */
  content: string;
  /**
   * Raw content blocks from the response. May include text, tool_use,
   * and (when adviser is active) advisor_tool_result blocks.
   * Typed as unknown[] because the SDK does not export types for
   * adviser-specific content blocks (beta feature).
   */
  rawContent: unknown[];
  /** The executor model that handled the request. */
  executorModel: string;
  /** Whether the adviser was called at least once. */
  adviserCalled: boolean;
  /** Number of times the adviser was invoked. */
  adviserCallCount: number;
  /** Token usage from the API response. */
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
  };
  /** Estimated cost in US cents. */
  costEstimateCents: number;
}

/** Shape for inserting a row into the api_usage_log Supabase table. */
export interface ApiUsageLogInsert {
  user_id: string;
  feature_key: string;
  executor_model: string;
  adviser_called: boolean;
  adviser_call_count: number;
  input_tokens: number;
  output_tokens: number;
  cost_estimate_cents: number;
  duration_ms: number;
  error?: string;
}
