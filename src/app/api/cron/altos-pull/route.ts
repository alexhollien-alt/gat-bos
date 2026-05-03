// Slice 8 Phase 2 -- Altos pull cron.
//
// Schedule: 0 13 * * 1 UTC (Mon 6 AM PHX, MST year-round, no DST). Wired in
// vercel.json during Phase 5. Manual trigger: GET with Bearer CRON_SECRET.
//
// For each market in TRACKED_MARKETS, fetch the current Altos snapshot and
// upsert into weekly_snapshot keyed by (week_of, market_slug). week_of is the
// Monday of the current ISO week (date, no time).
//
// Fill-and-flag: ALTOS_API_KEY is not yet provisioned. fetchAltosSnapshot
// returns { status: "pending_credentials" } and we still upsert the row so
// the assembly cron downstream has a row to read. The placeholder shape is
// the human-visible signal; reviewers see "pending_credentials" in the
// rendered draft and reject it. See BLOCKERS.md entry [2026-05-03].
//
// activity_events verbs: weekly_snapshot.pulled (per market success),
// weekly_snapshot.pull_failed (per market upsert error). Verbs added to
// src/lib/activity/types.ts in this same phase.

import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/api-auth";
import { logError } from "@/lib/error-log";
import { writeEvent } from "@/lib/activity/writeEvent";
import { TRACKED_MARKETS, type TrackedMarket } from "@/lib/markets/tracked";
import { fetchAltosSnapshot, type AltosSnapshotData } from "@/lib/altos/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE = "/api/cron/altos-pull";

interface MarketResult {
  slug: string;
  status: "upserted" | "failed";
  snapshot_id?: string;
  error?: string;
  data_status: AltosSnapshotData["status"];
}

function mondayOfIsoWeek(asOf: Date): string {
  const d = new Date(asOf);
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  const diff = (dow === 0 ? -6 : 1) - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

async function resolveAccountOwnerId(): Promise<string | null> {
  const { data, error } = await adminClient
    .from("accounts")
    .select("owner_user_id")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    await logError(ROUTE, `accounts owner lookup failed: ${error.message}`, {});
    return null;
  }
  return data?.owner_user_id ?? null;
}

async function pullOne(
  market: TrackedMarket,
  weekOf: string,
  ownerUserId: string | null,
): Promise<MarketResult> {
  let snapshot: AltosSnapshotData;
  try {
    snapshot = await fetchAltosSnapshot(market);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logError(ROUTE, `fetchAltosSnapshot threw: ${message}`, {
      market_slug: market.slug,
    });
    snapshot = {
      status: "error",
      median_price: null,
      dom: null,
      inventory: null,
      absorption: null,
      mom_delta: null,
      yoy_delta: null,
      error_message: message,
    };
  }

  const { data, error } = await adminClient
    .from("weekly_snapshot")
    .upsert(
      {
        week_of: weekOf,
        market_slug: market.slug,
        market_label: market.label,
        data: snapshot,
        pulled_at: new Date().toISOString(),
      },
      { onConflict: "week_of,market_slug" },
    )
    .select("id")
    .single();

  if (error) {
    await logError(ROUTE, `weekly_snapshot upsert failed: ${error.message}`, {
      market_slug: market.slug,
      week_of: weekOf,
    });
    if (ownerUserId) {
      await writeEvent({
        userId: ownerUserId,
        actorId: ownerUserId,
        verb: "weekly_snapshot.pull_failed",
        object: { table: "weekly_snapshot", id: market.slug },
        context: {
          week_of: weekOf,
          market_slug: market.slug,
          error: error.message,
        },
      });
    }
    return {
      slug: market.slug,
      status: "failed",
      error: error.message,
      data_status: snapshot.status,
    };
  }

  if (ownerUserId) {
    await writeEvent({
      userId: ownerUserId,
      actorId: ownerUserId,
      verb: "weekly_snapshot.pulled",
      object: { table: "weekly_snapshot", id: data.id },
      context: {
        week_of: weekOf,
        market_slug: market.slug,
        data_status: snapshot.status,
      },
    });
  }

  return {
    slug: market.slug,
    status: "upserted",
    snapshot_id: data.id,
    data_status: snapshot.status,
  };
}

async function handleRun(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const weekOf = mondayOfIsoWeek(new Date());
  const ownerUserId = await resolveAccountOwnerId();

  if (!ownerUserId) {
    await logError(ROUTE, "no account row found; activity_events writes skipped", {
      week_of: weekOf,
    });
  }

  const results: MarketResult[] = [];
  for (const market of TRACKED_MARKETS) {
    const result = await pullOne(market, weekOf, ownerUserId);
    results.push(result);
  }

  const upserted = results.filter((r) => r.status === "upserted").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    ok: failed === 0,
    week_of: weekOf,
    markets_total: TRACKED_MARKETS.length,
    upserted,
    failed,
    results,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await handleRun(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "altos-pull failed";
    await logError(ROUTE, `unhandled: ${message}`, {});
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
