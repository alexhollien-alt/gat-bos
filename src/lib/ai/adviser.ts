// src/lib/ai/adviser.ts
// Core utility for the Anthropic Adviser Strategy.
// The adviser tool lets cheaper executor models (Haiku/Sonnet) call a smarter
// adviser model (Opus) on-demand during complex reasoning. The API handles
// multi-model routing server-side.

import Anthropic from "@anthropic-ai/sdk";
import {
  MODEL_ROUTING,
  COST_PER_MTK,
  ESTIMATED_ADVISER_TOKENS_PER_CALL,
} from "@/config/model-routing";
import type {
  AdvisedCompletionOptions,
  AdvisedCompletionResult,
  ApiUsageLogInsert,
} from "./types";

const ADVISER_BETA = "advisor-tool-2026-03-01";
const ADVISER_MODEL = "claude-opus-4-6";

// Singleton SDK client. Reads ANTHROPIC_API_KEY from env.
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

/**
 * Estimate cost in US cents from token counts and adviser call count.
 */
function estimateCost(
  executorModel: string,
  usage: AdvisedCompletionResult["usage"],
  adviserCallCount: number
): number {
  const executorRates = COST_PER_MTK[executorModel] ?? { input: 3.0, output: 15.0 };
  const adviserRates = COST_PER_MTK[ADVISER_MODEL] ?? { input: 5.0, output: 25.0 };

  // Executor cost (all tokens go through executor pricing)
  const executorInputCost =
    (usage.inputTokens / 1_000_000) * executorRates.input;
  const executorOutputCost =
    (usage.outputTokens / 1_000_000) * executorRates.output;

  // Adviser cost estimate (tokens per call * adviser pricing)
  const adviserTokens = adviserCallCount * ESTIMATED_ADVISER_TOKENS_PER_CALL;
  const adviserCost =
    (adviserTokens / 1_000_000) * (adviserRates.input + adviserRates.output);

  // Convert dollars to cents
  return (executorInputCost + executorOutputCost + adviserCost) * 100;
}

/**
 * Log API usage to the api_usage_log table. Fire-and-forget -- never throws.
 */
async function logUsage(params: ApiUsageLogInsert): Promise<void> {
  try {
    // Lazy-import adminClient to avoid crashing when SUPABASE_URL is not set
    // (e.g. in test scripts that only need the Claude API, not Supabase).
    const { adminClient } = await import("@/lib/supabase/admin");
    await adminClient.from("api_usage_log").insert({
      user_id: params.user_id,
      feature_key: params.feature_key,
      executor_model: params.executor_model,
      adviser_called: params.adviser_called,
      adviser_call_count: params.adviser_call_count,
      input_tokens: params.input_tokens,
      output_tokens: params.output_tokens,
      cost_estimate_cents: params.cost_estimate_cents,
      duration_ms: params.duration_ms,
      error: params.error ?? null,
    });
  } catch {
    console.error("[ai/adviser] usage log insert failed");
  }
}

/**
 * Check if an error is adviser-related and should trigger a fallback retry.
 */
function isAdviserError(err: unknown): boolean {
  if (err instanceof Anthropic.BadRequestError) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("advisor") ||
      msg.includes("adviser") ||
      msg.includes(ADVISER_BETA)
    );
  }
  return false;
}

/**
 * Create a completion using the adviser strategy. Routes to the correct
 * executor model based on featureKey, optionally adding the adviser tool
 * for on-demand Opus escalation.
 *
 * When adviserMaxUses > 0: uses the beta messages API with the adviser tool.
 * When adviserMaxUses === 0: calls the standard messages API (no adviser overhead).
 *
 * On adviser-related errors, automatically retries once without the adviser.
 */
export async function createAdvisedCompletion(
  options: AdvisedCompletionOptions
): Promise<AdvisedCompletionResult> {
  const config = MODEL_ROUTING[options.featureKey];
  if (!config) {
    throw new Error(`Unknown feature key: ${options.featureKey}`);
  }

  const client = getClient();
  const maxTokens = options.maxTokens ?? 16000;
  const startMs = Date.now();

  // Build base params shared across both paths
  const baseParams = {
    model: config.executor,
    max_tokens: maxTokens,
    system: options.system,
    messages: options.messages,
  };

  let response: Anthropic.Message;

  if (config.adviserMaxUses > 0) {
    // Adviser-enabled path: use beta API with adviser tool
    const adviserTool = {
      type: "advisor_20260301" as const,
      name: "advisor" as const,
      model: ADVISER_MODEL,
      max_uses: config.adviserMaxUses,
    };

    // Build tools array: adviser tool + any user-provided tools
    // The adviser tool type is not in the SDK's ToolUnion, so we cast.
    const tools: unknown[] = [adviserTool];
    if (options.tools) {
      tools.push(...options.tools);
    }

    try {
      // Use beta.messages.create for the beta header
      response = (await client.beta.messages.create({
        ...baseParams,
        betas: [ADVISER_BETA],
        tools: tools as Anthropic.Beta.BetaToolUnion[],
      })) as unknown as Anthropic.Message;
    } catch (err) {
      if (isAdviserError(err)) {
        // Fallback: retry without adviser
        console.warn(
          "[ai/adviser] adviser error, falling back to executor-only:",
          err instanceof Error ? err.message : "unknown"
        );

        response = await client.messages.create({
          ...baseParams,
          tools: options.tools ?? [],
        });
      } else {
        throw err;
      }
    }
  } else {
    // No adviser -- standard API call
    response = await client.messages.create({
      ...baseParams,
      tools: options.tools ?? [],
    });
  }

  const durationMs = Date.now() - startMs;

  // Extract text content
  const textContent = response.content
    .filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    )
    .map((b) => b.text)
    .join("");

  // Count adviser calls by scanning for advisor_tool_result blocks.
  // The SDK may not have types for these beta content blocks, so we
  // check the type field as a string on the raw content array.
  const adviserCallCount = response.content.filter(
    (b: { type: string }) => b.type === "advisor_tool_result"
  ).length;

  // The SDK's Usage type may not expose cache fields directly, so access
  // them via an unknown-first cast to avoid TS2352.
  const rawUsage = response.usage as unknown as Record<string, number>;
  const usage: AdvisedCompletionResult["usage"] = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheCreationInputTokens: rawUsage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: rawUsage.cache_read_input_tokens ?? 0,
  };

  const costEstimateCents = estimateCost(
    config.executor,
    usage,
    adviserCallCount
  );

  const result: AdvisedCompletionResult = {
    content: textContent,
    rawContent: response.content as unknown[],
    executorModel: config.executor,
    adviserCalled: adviserCallCount > 0,
    adviserCallCount,
    usage,
    costEstimateCents,
  };

  // Log usage (fire-and-forget)
  if (options.userId) {
    logUsage({
      user_id: options.userId,
      feature_key: options.featureKey,
      executor_model: config.executor,
      adviser_called: adviserCallCount > 0,
      adviser_call_count: adviserCallCount,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cost_estimate_cents: costEstimateCents,
      duration_ms: durationMs,
    });
  }

  return result;
}

/**
 * Remove adviser tool artifacts from a message history array.
 * Use this when a feature hits its adviser budget and needs to continue
 * the conversation without adviser content blocks polluting the history.
 *
 * Filters out advisor_tool_use and advisor_tool_result blocks from
 * assistant messages. Removes messages that become empty after filtering.
 */
export function stripAdviserFromHistory(
  messages: Anthropic.MessageParam[]
): Anthropic.MessageParam[] {
  return messages
    .map((msg) => {
      if (msg.role !== "assistant" || typeof msg.content === "string") {
        return msg;
      }
      const filtered = (msg.content as unknown as Array<{ type: string }>).filter(
        (block) =>
          block.type !== "advisor_tool_use" &&
          block.type !== "advisor_tool_result"
      );
      return {
        ...msg,
        content: filtered as unknown as Anthropic.ContentBlockParam[],
      } as Anthropic.MessageParam;
    })
    .filter((msg) => {
      // Remove empty assistant messages
      if (
        msg.role === "assistant" &&
        Array.isArray(msg.content) &&
        msg.content.length === 0
      ) {
        return false;
      }
      return true;
    });
}
