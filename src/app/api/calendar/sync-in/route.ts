// Phase 1.5 Calendar inbound sync. Hourly cron pulls events from Google
// Calendar (now-1h .. now+7d) and upserts into public.events on gcal_event_id.
// GCal wins on conflict: every field is overwritten from the inbound payload.
// Dual auth: Bearer CRON_SECRET for cron + Supabase session (Alex) for manual trigger.
import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { listEvents, type CalendarEventOutput } from "@/lib/calendar/client";
import { verifyBearerOrSession } from "@/lib/api-auth";
import { logError as sharedLogError } from "@/lib/error-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE = "/api/calendar/sync-in";
const PULL_WINDOW_HOURS_BACK = 1;
const PULL_WINDOW_DAYS_FORWARD = 7;

async function logError(
  error_message: string,
  context: Record<string, unknown>,
  error_code?: number,
) {
  await sharedLogError(ROUTE, error_message, context, error_code);
}

interface SyncResult {
  pulled: number;
  upserted: number;
  skipped: number;
  reasons: Record<string, number>;
  window_start: string;
  window_end: string;
}

async function upsertEvent(event: CalendarEventOutput): Promise<"upserted" | "skipped"> {
  const { error } = await adminClient.from("events").upsert(
    {
      gcal_event_id: event.gcalEventId,
      title: event.title,
      description: event.description,
      start_at: event.startAt.toISOString(),
      end_at: event.endAt.toISOString(),
      location: event.location,
      attendees: event.attendees,
      source: "gcal_pull",
      synced_at: new Date().toISOString(),
    },
    { onConflict: "gcal_event_id" },
  );
  if (error) {
    await logError(`events upsert failed: ${error.message}`, { gcal_event_id: event.gcalEventId });
    return "skipped";
  }
  return "upserted";
}

async function runSync(): Promise<SyncResult> {
  const now = new Date();
  const timeMin = new Date(now.getTime() - PULL_WINDOW_HOURS_BACK * 60 * 60 * 1000);
  const timeMax = new Date(now.getTime() + PULL_WINDOW_DAYS_FORWARD * 24 * 60 * 60 * 1000);

  const pulled = await listEvents(timeMin, timeMax);

  let upserted = 0;
  let skipped = 0;
  const reasons: Record<string, number> = {};

  for (const event of pulled) {
    try {
      const verdict = await upsertEvent(event);
      if (verdict === "upserted") upserted++;
      else {
        skipped++;
        reasons["upsert_error"] = (reasons["upsert_error"] ?? 0) + 1;
      }
    } catch (err) {
      skipped++;
      reasons["exception"] = (reasons["exception"] ?? 0) + 1;
      await logError(
        `sync loop exception: ${err instanceof Error ? err.message : String(err)}`,
        { gcal_event_id: event.gcalEventId },
      );
    }
  }

  return {
    pulled: pulled.length,
    upserted,
    skipped,
    reasons,
    window_start: timeMin.toISOString(),
    window_end: timeMax.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  if (process.env.ROLLBACK_CAL_SYNC === "true") {
    return NextResponse.json({ error: "Calendar sync disabled" }, { status: 503 });
  }
  if (!(await verifyBearerOrSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    await logError(`sync entry failed: ${message}`, {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (process.env.ROLLBACK_CAL_SYNC === "true") {
    return NextResponse.json({ error: "Calendar sync disabled" }, { status: 503 });
  }
  if (!(await verifyBearerOrSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    await logError(`sync entry failed: ${message}`, {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
