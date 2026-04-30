// Phase 1.5 Calendar outbound create. Dashboard creates event locally first,
// then mirrors to Google Calendar and backfills gcal_event_id.
// Dashboard is canonical; if gcal_event_id is already populated on the row,
// do not re-insert (the inbound cron owns subsequent updates).
// Slice 7A -- 2026-04-30: tenantFromRequest replaces verifyBearerOrSession.
// This route is dashboard-only (no cron schedule, no skill caller); the
// session is required to derive user_id for events.user_id (column-based RLS)
// and downstream writeEvent/firePostCreationHooks.
// Kill switch: ROLLBACK_CAL_WRITE=true returns 503 on outbound write only.
import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { insertEvent, type CalendarAttendee } from "@/lib/calendar/client";
import { tenantFromRequest, TenantResolutionError } from "@/lib/auth/tenantFromRequest";
import { logError as sharedLogError } from "@/lib/error-log";
import { writeEvent } from "@/lib/activity/writeEvent";
import { firePostCreationHooks } from "@/lib/hooks/post-creation";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ROUTE = "/api/calendar/create";

interface CreateBody {
  title?: string;
  description?: string;
  start_at?: string;
  end_at?: string;
  location?: string;
  attendees?: CalendarAttendee[];
  project_id?: string | null;
  contact_id?: string | null;
}

async function logError(
  error_message: string,
  context: Record<string, unknown>,
  error_code?: number,
) {
  await sharedLogError(ROUTE, error_message, context, error_code);
}

export async function POST(request: NextRequest) {
  if (process.env.ROLLBACK_CAL_WRITE === "true") {
    return NextResponse.json({ error: "Calendar write disabled" }, { status: 503 });
  }

  let userId: string;
  try {
    const ctx = await tenantFromRequest(request);
    if (ctx.kind !== "user") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = ctx.userId;
  } catch (err) {
    if (err instanceof TenantResolutionError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const body = (await request.json().catch(() => ({}))) as CreateBody;

  if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!body.start_at || !body.end_at) {
    return NextResponse.json({ error: "start_at and end_at are required (ISO-8601)" }, { status: 400 });
  }
  const startAt = new Date(body.start_at);
  const endAt = new Date(body.end_at);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return NextResponse.json({ error: "start_at and end_at must be valid ISO-8601" }, { status: 400 });
  }
  if (endAt.getTime() <= startAt.getTime()) {
    return NextResponse.json({ error: "end_at must be after start_at" }, { status: 400 });
  }

  const title = body.title.trim();

  // Step 1: insert the local row first. gcal_event_id starts NULL.
  const { data: localRow, error: insertErr } = await adminClient
    .from("events")
    .insert({
      user_id: userId,
      title,
      description: body.description ?? null,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      location: body.location ?? null,
      attendees: body.attendees ?? [],
      project_id: body.project_id ?? null,
      contact_id: body.contact_id ?? null,
      source: "dashboard_create",
    })
    .select()
    .single();

  if (insertErr || !localRow) {
    await logError(`local insert failed: ${insertErr?.message ?? "no row returned"}`, {
      title,
      start_at: startAt.toISOString(),
    });
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to insert event" },
      { status: 500 },
    );
  }

  // event.created is not contact-specific. contact_id not included.
  // Slice 2 improvement if calendar events ever need per-contact timeline indexing.
  void writeEvent({
    userId,
    actorId: userId,
    verb: 'event.created',
    object: { table: 'events', id: localRow.id },
    context: { title },
  });

  // Slice 5B: post-creation hooks. project_id present -> insert
  // project_touchpoints; contact_id only -> activity_events
  // event.contact_only. Idempotent + fire-and-forget.
  await firePostCreationHooks({
    entityKind: "event",
    entityId: localRow.id,
    payload: localRow,
    ownerUserId: userId,
  });

  // Step 2: write to Google Calendar. On failure, keep the local row (null
  // gcal_event_id) so Alex can see it and retry later via a future reconcile.
  try {
    const gcalEvent = await insertEvent({
      title,
      description: body.description ?? null,
      startAt,
      endAt,
      location: body.location ?? null,
      attendees: body.attendees,
    });

    const { data: updated, error: updateErr } = await adminClient
      .from("events")
      .update({
        gcal_event_id: gcalEvent.gcalEventId,
        synced_at: new Date().toISOString(),
      })
      .eq("id", localRow.id)
      .select()
      .single();

    if (updateErr || !updated) {
      await logError(`gcal_event_id backfill failed: ${updateErr?.message ?? "no row"}`, {
        event_id: localRow.id,
        gcal_event_id: gcalEvent.gcalEventId,
      });
      return NextResponse.json(
        {
          ok: true,
          warning: "Event created in GCal but local gcal_event_id backfill failed",
          event: localRow,
          gcal_event_id: gcalEvent.gcalEventId,
        },
        { status: 201 },
      );
    }

    return NextResponse.json({ ok: true, event: updated }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "gcal insert failed";
    await logError(`gcal insert failed: ${message}`, {
      event_id: localRow.id,
      title,
    });
    return NextResponse.json(
      {
        ok: true,
        warning: "Event stored locally but Google Calendar write failed. Retry will backfill gcal_event_id.",
        event: localRow,
        gcal_error: message,
      },
      { status: 201 },
    );
  }
}
