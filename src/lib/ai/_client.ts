// Shared Anthropic SDK client + callClaude wrapper.
//
// Every Slice 6 capability calls Claude through callClaude. The wrapper
// composes:
//   1. Budget guard via _budget.checkBudget (throws BudgetExceededError on cap)
//   2. Optional cache lookup via _cache.cacheGet (skips Anthropic on hit)
//   3. Anthropic SDK call (claude-sonnet-4-6 default; capability may override)
//   4. ai_usage_log row write with priced cost
//   5. Optional cache write via _cache.cacheSet
//
// Two cache layers in play:
//   - Anthropic prompt cache (5-min TTL, server-side, automatic) -- enabled
//     when the capability sets `cache_control: {type: 'ephemeral'}` on the
//     system prompt. Covers in-flight prefix reuse.
//   - ai_cache (this app, DB-backed, per-feature) -- enabled when the caller
//     passes a `cacheKey`. Covers durable result reuse across processes.

import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "@/lib/retry";
import { adminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/error-log";
import {
  BudgetExceededError,
  checkBudget,
  maybeWriteSoftCapWarning,
  writeBudgetBlocked,
} from "./_budget";
import { cacheGet, cacheSet } from "./_cache";
import { priceUsage, type UsageTokens } from "./_pricing";

export { BudgetExceededError } from "./_budget";

export const DEFAULT_MODEL = "claude-sonnet-4-6";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey });
  return _client;
}

export interface CallClaudeParams {
  feature: string;
  // Tenant owner of this call. Required: ai_usage_log, budget warnings, and
  // budget-blocked events all key on user_id under Slice 7A RLS.
  userId: string;
  system: Anthropic.MessageCreateParams["system"];
  messages: Anthropic.MessageParam[];
  model?: string;
  max_tokens: number;
  tools?: Anthropic.MessageCreateParams["tools"];
  // Optional ai_cache integration. When `cacheKey` is set, lookup before
  // calling Anthropic; on miss, write the response after success.
  cacheKey?: string;
  cacheTtlSeconds?: number | null;
  // Optional retry-helper label override (default: claude.<feature>).
  retryLabel?: string;
}

export interface CallClaudeResult {
  message: Anthropic.Message;
  cached: boolean;
  cost_usd: number;
  usage: UsageTokens;
}

export async function callClaude(params: CallClaudeParams): Promise<CallClaudeResult> {
  const {
    feature,
    userId,
    system,
    messages,
    model = DEFAULT_MODEL,
    max_tokens,
    tools,
    cacheKey,
    cacheTtlSeconds = null,
    retryLabel,
  } = params;

  // 1. Cache lookup (before budget -- a cache hit skips spend entirely).
  if (cacheKey) {
    const hit = await cacheGet<Anthropic.Message>({ feature, key: cacheKey });
    if (hit) {
      // Still log the cache hit to ai_usage_log so the audit trail is complete.
      await writeUsageLog({
        feature,
        userId,
        model: hit.model ?? model,
        usage: zeroUsage(),
        cost_usd: 0,
        context: { cache_hit: true },
      });
      return { message: hit, cached: true, cost_usd: 0, usage: zeroUsage() };
    }
  }

  // 2. Budget guard.
  const status = await checkBudget(feature, userId);
  if (status.blocked) {
    await writeBudgetBlocked(feature, userId, status);
    throw new BudgetExceededError(feature, status.remaining_usd, status.budget_usd);
  }
  if (status.soft_cap_breached) {
    await maybeWriteSoftCapWarning(feature, userId, status);
  }

  // 3. Anthropic call.
  const client = getClient();
  let response: Anthropic.Message;
  try {
    response = await withRetry(
      () =>
        client.messages.create({
          model,
          max_tokens,
          system,
          messages,
          ...(tools ? { tools } : {}),
        }),
      retryLabel ?? `claude.${feature}`,
    );
  } catch (err) {
    // Log the failure row so cost-per-failure is visible.
    await writeUsageLog({
      feature,
      userId,
      model,
      usage: zeroUsage(),
      cost_usd: 0,
      context: {
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }

  // 4. Price + log success.
  const usage: UsageTokens = {
    input_tokens: response.usage?.input_tokens ?? 0,
    output_tokens: response.usage?.output_tokens ?? 0,
    cache_read_tokens: response.usage?.cache_read_input_tokens ?? 0,
    cache_creation_tokens: response.usage?.cache_creation_input_tokens ?? 0,
  };
  const cost_usd = priceUsage(response.model ?? model, usage);
  await writeUsageLog({
    feature,
    userId,
    model: response.model ?? model,
    usage,
    cost_usd,
    context: { stop_reason: response.stop_reason },
  });

  // 5. Cache write (best-effort; cache miss should not break the call).
  if (cacheKey) {
    await cacheSet({
      feature,
      key: cacheKey,
      value: response,
      model: response.model ?? model,
      ttl_seconds: cacheTtlSeconds,
    });
  }

  return { message: response, cached: false, cost_usd, usage };
}

function zeroUsage(): UsageTokens {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
  };
}

async function writeUsageLog(params: {
  feature: string;
  userId: string;
  model: string;
  usage: UsageTokens;
  cost_usd: number;
  context: Record<string, unknown>;
}): Promise<void> {
  const { feature, userId, model, usage, cost_usd, context } = params;
  const { error } = await adminClient.from("ai_usage_log").insert({
    feature,
    model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_tokens: usage.cache_read_tokens,
    cache_creation_tokens: usage.cache_creation_tokens,
    cost_usd,
    context,
    user_id: userId,
  });
  if (error) {
    await logError("ai/_client.writeUsageLog", error.message, { feature, model });
  }
}
