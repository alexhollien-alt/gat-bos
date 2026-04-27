// Per-model pricing for Anthropic API cost computation. Used by _client.ts to
// price every Claude call before writing to ai_usage_log.
//
// Rates as of Slice 6 (2026-04-27). Source: platform.claude.com/docs/en/pricing.
// Rates are USD per 1M tokens. Cache reads bill at ~0.1x input. Cache writes
// (5-minute TTL) bill at ~1.25x input.
//
// Update procedure: when Anthropic changes pricing, edit this table and bump
// PRICING_VERSION. Never silently re-base. Document the change in BUILD.md.

export const PRICING_VERSION = "2026-04-27";

interface ModelRates {
  input_per_million: number;
  output_per_million: number;
  cache_read_per_million: number;
  cache_write_per_million: number;
}

const RATES: Record<string, ModelRates> = {
  "claude-sonnet-4-6": {
    input_per_million: 3.0,
    output_per_million: 15.0,
    cache_read_per_million: 0.3,
    cache_write_per_million: 3.75,
  },
  "claude-haiku-4-5": {
    input_per_million: 1.0,
    output_per_million: 5.0,
    cache_read_per_million: 0.1,
    cache_write_per_million: 1.25,
  },
  "claude-haiku-4-5-20251001": {
    input_per_million: 1.0,
    output_per_million: 5.0,
    cache_read_per_million: 0.1,
    cache_write_per_million: 1.25,
  },
  "claude-opus-4-7": {
    input_per_million: 5.0,
    output_per_million: 25.0,
    cache_read_per_million: 0.5,
    cache_write_per_million: 6.25,
  },
  "claude-opus-4-6": {
    input_per_million: 5.0,
    output_per_million: 25.0,
    cache_read_per_million: 0.5,
    cache_write_per_million: 6.25,
  },
};

export interface UsageTokens {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
}

export function priceUsage(model: string, usage: UsageTokens): number {
  const rates = RATES[model];
  if (!rates) {
    // Unknown model: bill conservatively at Opus rates so we don't silently
    // under-account for a new model that landed in code before this table.
    const fallback = RATES["claude-opus-4-7"];
    return computeCost(fallback, usage);
  }
  return computeCost(rates, usage);
}

function computeCost(rates: ModelRates, usage: UsageTokens): number {
  const cost =
    (usage.input_tokens / 1_000_000) * rates.input_per_million +
    (usage.output_tokens / 1_000_000) * rates.output_per_million +
    (usage.cache_read_tokens / 1_000_000) * rates.cache_read_per_million +
    (usage.cache_creation_tokens / 1_000_000) * rates.cache_write_per_million;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
