import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import type { ActivityVerb } from "@/lib/activity/types";

const ALLOWED_TYPES = new Set([
  "call",
  "text",
  "email",
  "meeting",
  "broker_open",
  "lunch",
  "note",
  "email_sent",
  "email_received",
  "event",
]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { contact_id, type, summary, direction, duration_minutes, occurred_at } =
    body as {
      contact_id?: string;
      type?: string;
      summary?: string;
      direction?: string;
      duration_minutes?: number;
      occurred_at?: string;
    };

  if (!contact_id || !type || !summary) {
    return NextResponse.json(
      { error: "missing required fields: contact_id, type, summary" },
      { status: 400 }
    );
  }
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  const verb = `interaction.${type}` as ActivityVerb;
  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    actor_id: user.id,
    verb,
    object_table: "contacts",
    object_id: contact_id,
    context: {
      contact_id,
      type,
      summary,
      ...(direction ? { direction } : {}),
      ...(duration_minutes != null ? { duration_minutes } : {}),
      source: "api_endpoint",
    },
  };
  if (occurred_at) {
    insertPayload.occurred_at = occurred_at;
  }

  const { data, error } = await adminClient
    .from("activity_events")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "insert failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ event_id: data.id }, { status: 201 });
}
