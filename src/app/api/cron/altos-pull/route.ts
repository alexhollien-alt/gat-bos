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

  // Explicit SELECT-then-INSERT-or-UPDATE flow honoring deleted_at IS NULL.
  // Postgres ON CONFLICT cannot infer the partial unique index
  // (weekly_snapshot_week_market_uniq ... WHERE deleted_at IS NULL) without a
  // matching WHERE clause, and supabase-js .upsert() does not pass one. The
  // partial index is preserved so a soft-deleted row can be re-pulled cleanly.
  // See ~/crm/.planning/phases/022-slice-8-phase-5-5-altos-pull-upsert-fix/.
  const pulledAt = new Date().toISOString();
  const { data: existing, error: selectError } = await adminClient
    .from("weekly_snapshot")
    .select("id")
    .eq("week_of", weekOf)
    .eq("market_slug", market.slug)
    .is("deleted_at", null)
    .maybeSingle();

  let data: { id: string } | null = null;
  let error: { message: string } | null = selectError;

  if (!error) {
    if (existing) {
      const { data: updated, error: updateError } = await adminClient
        .from("weekly_snapshot")
        .update({
          market_label: market.label,
          data: snapshot,
          pulled_at: pulledAt,
        })
        .eq("id", existing.id)
        .select("id")
        .single();
      data = updated;
      error = updateError;
    } else {
      const { data: inserted, error: insertError } = await adminClient
        .from("weekly_snapshot")
        .insert({
          week_of: weekOf,
          market_slug: market.slug,
          market_label: market.label,
          data: snapshot,
          pulled_at: pulledAt,
        })
        .select("id")
        .single();
      data = inserted;
      error = insertError;
    }
  }

  if (error || !data) {
    const message = error?.message ?? "weekly_snapshot write returned no row";
    await logError(ROUTE, `weekly_snapshot upsert failed: ${message}`, {
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
          error: message,
        },
      });
    }
    return {
      slug: market.slug,
      status: "failed",
      error: message,
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
