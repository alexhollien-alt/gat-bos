// src/app/api/cron/morning-brief/route.ts
//
// Phase 1 morning relationship brief. Runs nightly at 12:30 UTC
// (5:30am MST -- Phoenix is UTC-7 year-round, no DST).
//
// Step 4 wires the Claude API assembly. Scoring runs first (deterministic),
// then the ranked output + congrats queue feeds assembleBrief() to produce
// the narrative markdown that Alex reads at /morning.
//
// Auth: Bearer CRON_SECRET (Vercel cron header).
// Runtime: Node (service-role client, no edge restrictions).
// Persistence: one row per brief_date in `morning_briefs`,
//   soft-delete-aware upsert.

import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/api-auth";
import { logError } from "@/lib/error-log";
import { scoreContacts, type TemperatureRow } from "@/lib/scoring/temperature";
import { assembleBrief, type BriefRankedContact } from "@/lib/claude/brief-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE = "/api/cron/morning-brief";

type CongratsItem = {
  contact_id: string;
  full_name: string;
  event_type: string;
  event_at: string;
};

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const briefDate = todayInPhoenix();

  try {
    const ranked = await scoreContacts(adminClient);
    const congrats: CongratsItem[] = []; // [PHASE 2] empty until MLS feed

    const brief = await assembleBrief({
      brief_date: briefDate,
      temperature_ranking: ranked.map(toBriefRanked),
      congrats_queue: congrats,
    });

    const briefJson = {
      temperature_ranking: ranked,
      congrats_queue: congrats,
      watch_list: [],
      one_thing: ranked[0]?.full_name ?? null,
    };

    await upsertBrief(briefDate, {
      brief_json: briefJson,
      brief_text: brief.text,
      model: brief.model,
      usage: brief.usage,
      contacts_scored: ranked.length,
    });

    return NextResponse.json({
      ok: true,
      briefDate,
      contactsScored: ranked.length,
      model: brief.model,
      usage: brief.usage,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logError(ROUTE, `morning-brief failed: ${message}`, {
      brief_date: briefDate,
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: message, briefDate, durationMs: Date.now() - startedAt },
      { status: 500 },
    );
  }
}

function todayInPhoenix(): string {
  const phoenixMs = Date.now() - 7 * 60 * 60 * 1000;
  return new Date(phoenixMs).toISOString().slice(0, 10);
}

async function upsertBrief(
  briefDate: string,
  payload: {
    brief_json: unknown;
    brief_text: string;
    model: string;
    usage: unknown;
    contacts_scored: number;
  },
) {
  const { data: existing, error: selErr } = await adminClient
    .from("morning_briefs")
    .select("id")
    .eq("brief_date", briefDate)
    .is("deleted_at", null)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    const { error } = await adminClient
      .from("morning_briefs")
      .update({
        brief_json: payload.brief_json,
        brief_text: payload.brief_text,
        model: payload.model,
        usage: payload.usage,
        contacts_scored: payload.contacts_scored,
        generated_at: new Date().toISOString(),
        errors: null,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await adminClient.from("morning_briefs").insert({
    brief_date: briefDate,
    brief_json: payload.brief_json,
    brief_text: payload.brief_text,
    model: payload.model,
    usage: payload.usage,
    contacts_scored: payload.contacts_scored,
    errors: null,
  });
  if (error) throw error;
}

function toBriefRanked(row: TemperatureRow): BriefRankedContact {
  return {
    full_name: row.full_name,
    brokerage: row.brokerage,
    tier: row.tier,
    days_since_last_touchpoint: row.days_since_last_touchpoint,
    last_touchpoint_type: row.last_touchpoint_type,
    tier_target: row.tier_target,
    drift: row.drift,
    active_escrows: row.active_escrows,
    effective_drift: row.effective_drift,
  };
}
