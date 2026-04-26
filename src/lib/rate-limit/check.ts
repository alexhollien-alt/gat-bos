// Supabase-backed sliding-window rate limiter.
//
// Storage: public.rate_limits (key text, count int, window_start timestamptz),
// PK (key, window_start). Service-role only -- RLS denies anon/authenticated.
// Atomic increment: public.increment_rate_limit(p_key, p_window_start) RPC,
// SECURITY DEFINER, executes the canonical
//   INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count
// pattern in a single statement.
//
// Window math: discrete fixed windows of size windowSec aligned to the unix
// epoch. windowStart = floor(now / windowSec) * windowSec. The first caller
// of a window inserts a row with count=1; every subsequent caller hits the
// PK conflict and the RPC bumps count atomically.
//
// Hard-delete carve-out: rate_limits rows are time-bounded operational data.
// Standing Rule 3 (no hard deletes) excludes operational counter tables --
// soft-delete with deleted_at would let counters grow unbounded. Lazy
// cleanup deletes rows with window_start < now() - 2 * windowSec on each
// call, fire-and-forget.
//
// Failure mode: if the RPC throws or returns null, FAIL OPEN. Inbound write
// paths prefer availability over enforcement -- a transient DB blip must
// not 503 the intake/captures pipeline. Fail-open events surface in Vercel
// logs via console.warn so silent enforcement gaps stay visible.

import { adminClient } from "@/lib/supabase/admin";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStartSec = Math.floor(nowSec / windowSec) * windowSec;
  const windowStart = new Date(windowStartSec * 1000);
  const resetAt = new Date((windowStartSec + windowSec) * 1000);

  try {
    const { data, error } = await adminClient.rpc("increment_rate_limit", {
      p_key: key,
      p_window_start: windowStart.toISOString(),
    });

    if (error) throw error;
    if (typeof data !== "number") {
      throw new Error(`unexpected RPC return: ${JSON.stringify(data)}`);
    }

    const count = data;

    // Lazy cleanup, fire-and-forget. Errors swallowed; cleanup is
    // best-effort and never blocks the limiter decision.
    const cutoff = new Date((nowSec - 2 * windowSec) * 1000).toISOString();
    void adminClient
      .from("rate_limits")
      .delete()
      .lt("window_start", cutoff)
      .then(() => null, () => null);

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[rate-limit] check failed, failing open:", {
      route: key,
      error: message,
    });
    return { allowed: true, remaining: limit, resetAt };
  }
}
