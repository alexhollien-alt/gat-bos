// DEPRECATED (Slice 1, 2026-04-22): spine is superseded by activity_events.
// Do not extend. Will be deleted in Slice 2.
// src/lib/spine/queries.ts
// Server-side Supabase query helpers for the spine.
// Used by API routes. Assumes the Supabase client is passed in.

import { SupabaseClient } from "@supabase/supabase-js";
import type { TodayPayloadT } from "./types";

/**
 * Returns the ISO date string for Monday of the current week (UTC).
 */
export function currentMondayISO(d: Date = new Date()): string {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Mon = 1
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

/**
 * Fetches the full Today Command payload in one round-trip set.
 * Caller must provide a session-authed or service-role Supabase client.
 */
export async function fetchTodayPayload(
  supabase: SupabaseClient,
  userId: string
): Promise<TodayPayloadT> {
  const weekOf = currentMondayISO();
  const now = new Date().toISOString();
  const in48h = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

  // Run queries in parallel.
  const [
    focusRes,
    overdueRes,
    signalsRes,
    comingDueRes,
    weekSummaryRes,
    capturesRes,
  ] = await Promise.all([
    supabase
      .from("focus_queue")
      .select(`
        *,
        contact:contacts(id,first_name,last_name,email,phone,headshot_url,tier)
      `)
      .eq("user_id", userId)
      .eq("week_of", weekOf)
      .eq("status", "pending")
      .is("deleted_at", null)
      .order("rank", { ascending: true })
      .limit(5),
    supabase
      .from("commitments")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "open")
      .lt("due_at", now)
      .is("deleted_at", null)
      .order("due_at", { ascending: true })
      .limit(20),
    supabase
      .from("signals")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("severity", ["high", "urgent"])
      .gt("window_end", now)
      .is("deleted_at", null)
      .order("severity", { ascending: false })
      .limit(10),
    supabase
      .from("cycle_state")
      .select(`
        *,
        contact:contacts(id,first_name,last_name)
      `)
      .eq("user_id", userId)
      .eq("status", "active")
      .lt("next_due_at", in48h)
      .gte("next_due_at", now)
      .order("next_due_at", { ascending: true })
      .limit(10),
    supabase
      .from("focus_queue")
      .select("status")
      .eq("user_id", userId)
      .eq("week_of", weekOf)
      .is("deleted_at", null),
    supabase
      .from("spine_inbox")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("captured_at", { ascending: false })
      .limit(5),
  ]);

  // Surface errors.
  for (const res of [focusRes, overdueRes, signalsRes, comingDueRes, weekSummaryRes, capturesRes]) {
    if (res.error) throw new Error(`spine query failed: ${res.error.message}`);
  }

  // Build week summary
  const statuses = (weekSummaryRes.data ?? []).map((r: { status: string }) => r.status);
  const weekRotationSummary = {
    total: statuses.length,
    pending: statuses.filter((s: string) => s === "pending").length,
    touched: statuses.filter((s: string) => s === "touched").length,
    skipped: statuses.filter((s: string) => s === "skipped").length,
    deferred: statuses.filter((s: string) => s === "deferred").length,
  };

  // Content calendar: placeholder that returns an empty list for Phase 1.
  // Phase 5 will populate this from actual schedule sources.
  const contentCalendar: TodayPayloadT["content_calendar"] = [];

  return {
    today_focus: (focusRes.data ?? []).map((row: Record<string, unknown>) => ({
      focus: {
        id: row.id as string,
        user_id: row.user_id as string,
        contact_id: row.contact_id as string,
        week_of: row.week_of as string,
        rank: row.rank as number | null,
        reason: row.reason as "signal" | "cadence" | "manual" | "commitment" | null,
        reason_detail: row.reason_detail as string | null,
        suggested_action: row.suggested_action as string | null,
        status: row.status as "pending" | "touched" | "skipped" | "deferred",
        touched_at: row.touched_at as string | null,
        touched_via: row.touched_via as string | null,
        outcome: row.outcome as "warm" | "cold" | "delivered" | "no_answer" | "left_message" | null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        deleted_at: row.deleted_at as string | null,
      },
      contact: row.contact as TodayPayloadT["today_focus"][number]["contact"],
    })),
    overdue_commitments: (overdueRes.data ?? []) as TodayPayloadT["overdue_commitments"],
    high_signals: (signalsRes.data ?? []) as TodayPayloadT["high_signals"],
    coming_due: (comingDueRes.data ?? []).map((row: Record<string, unknown>) => ({
      cycle: {
        contact_id: row.contact_id as string,
        user_id: row.user_id as string,
        cadence_days: row.cadence_days as number | null,
        tier_override: row.tier_override as string | null,
        paused_until: row.paused_until as string | null,
        last_touched_at: row.last_touched_at as string | null,
        next_due_at: row.next_due_at as string | null,
        current_streak_days: row.current_streak_days as number | null,
        status: row.status as "active" | "paused" | "dormant" | "lost" | null,
        notes: row.notes as string | null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
      },
      contact: row.contact as TodayPayloadT["coming_due"][number]["contact"],
    })),
    week_rotation_summary: weekRotationSummary,
    recent_captures: (capturesRes.data ?? []) as TodayPayloadT["recent_captures"],
    content_calendar: contentCalendar,
  };
}
