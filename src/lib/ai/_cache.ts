// Per-feature durable result cache. Distinct from Anthropic's prompt cache.
//
// Anthropic prompt cache: 5-min server-side TTL, automatic, applied via
// `cache_control` on system blocks. Covers in-flight reuse of prefix tokens.
//
// ai_cache (this helper): durable, DB-backed, per-feature. Same input fired
// again later in the same day (or across processes) returns the prior result
// without re-hitting Anthropic. Each capability owns its cache_key derivation
// because what counts as "same input" is feature-specific.

import { createHash } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/error-log";

export interface CacheEntry<T = unknown> {
  value: T;
  model: string | null;
  expires_at: string | null;
  accessed_at: string;
  created_at: string;
}

export function cacheKey(feature: string, normalizedInput: unknown): string {
  const h = createHash("sha256");
  h.update(`${feature}::`);
  h.update(stableStringify(normalizedInput));
  return h.digest("hex");
}

// Deterministic JSON stringify -- sorts object keys recursively so semantically
// identical inputs hash to the same key regardless of key order.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export async function cacheGet<T = unknown>(params: {
  feature: string;
  key: string;
}): Promise<T | null> {
  const { feature, key } = params;
  const { data, error } = await adminClient
    .from("ai_cache")
    .select("value, expires_at")
    .eq("feature", feature)
    .eq("cache_key", key)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    await logError("ai/_cache.get", error.message, { feature });
    return null;
  }
  if (!data) return null;

  if (data.expires_at) {
    const expires = new Date(data.expires_at).getTime();
    if (Number.isFinite(expires) && expires <= Date.now()) {
      return null;
    }
  }

  // Best-effort accessed_at touch. Not awaited; cache reads stay snappy.
  void adminClient
    .from("ai_cache")
    .update({ accessed_at: new Date().toISOString() })
    .eq("feature", feature)
    .eq("cache_key", key)
    .then(() => null, () => null);

  return data.value as T;
}

export async function cacheSet(params: {
  feature: string;
  key: string;
  value: unknown;
  model?: string | null;
  ttl_seconds?: number | null;
}): Promise<void> {
  const { feature, key, value, model = null, ttl_seconds } = params;
  const expires_at =
    typeof ttl_seconds === "number" && ttl_seconds > 0
      ? new Date(Date.now() + ttl_seconds * 1000).toISOString()
      : null;

  const { error } = await adminClient
    .from("ai_cache")
    .upsert(
      {
        feature,
        cache_key: key,
        value: value as never,
        model,
        expires_at,
        accessed_at: new Date().toISOString(),
      },
      { onConflict: "feature,cache_key" },
    );

  if (error) {
    await logError("ai/_cache.set", error.message, { feature });
  }
}
