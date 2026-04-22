// src/app/api/cron/recompute-health-scores/route.ts
//
// Daily relationship-health recompute. Drains time-decay staleness so
// dormant contacts lose score between touchpoint events. Trigger
// `trg_touchpoint_recompute_health` keeps active contacts fresh; this
// cron covers everyone else.
//
// Auth: Bearer CRON_SECRET (Vercel cron header).
// Runtime: Node (service-role client, no edge restrictions).
// Schedule: 11:00 UTC daily = 04:00 Phoenix (AZ is UTC-7 year-round).
//
// Failure path: fire-and-forget write to error_logs, 500 response.
// Success path: JSON summary; Vercel cron logs capture timing + count.

import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/api-auth";
import { logError } from "@/lib/error-log";

export const runtime = "nodejs";

const ROUTE = "/api/cron/recompute-health-scores";
const BATCH_LIMIT = 500;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  const { data, error } = await adminClient.rpc(
    "recompute_all_relationship_health_scores",
    { p_batch_limit: BATCH_LIMIT }
  );

  const durationMs = Date.now() - startedAt;

  if (error) {
    await logError(ROUTE, `recompute failed: ${error.message}`, {
      duration_ms: durationMs,
      batch_limit: BATCH_LIMIT,
    });
    return NextResponse.json(
      { error: error.message, duration_ms: durationMs },
      { status: 500 }
    );
  }

  const processed = typeof data === "number" ? data : 0;

  return NextResponse.json({
    processed,
    batch_limit: BATCH_LIMIT,
    duration_ms: durationMs,
  });
}
