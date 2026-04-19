import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireApiToken } from "@/lib/api-auth";

const TOUCHPOINT_TYPES = [
  "email",
  "event",
  "voice_memo",
  "contact_note",
] as const;

const ENTITY_TABLES = [
  "emails",
  "email_drafts",
  "events",
  "contacts",
  "notes",
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = requireApiToken(request);
  if (unauth) return unauth;

  const { id } = await params;

  const { data: project, error: projectError } = await adminClient
    .from("projects")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (projectError) {
    const status = projectError.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: projectError.message }, { status });
  }
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data, error } = await adminClient
    .from("project_touchpoints")
    .select("*")
    .eq("project_id", id)
    .order("occurred_at", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = requireApiToken(request);
  if (unauth) return unauth;

  const { id } = await params;
  const body = await request.json();

  if (!body.touchpoint_type || !(TOUCHPOINT_TYPES as readonly string[]).includes(body.touchpoint_type)) {
    return NextResponse.json(
      { error: `touchpoint_type must be one of: ${TOUCHPOINT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (!body.entity_id || typeof body.entity_id !== "string") {
    return NextResponse.json({ error: "entity_id is required" }, { status: 400 });
  }
  if (!body.entity_table || !(ENTITY_TABLES as readonly string[]).includes(body.entity_table)) {
    return NextResponse.json(
      { error: `entity_table must be one of: ${ENTITY_TABLES.join(", ")}` },
      { status: 400 }
    );
  }

  const { data: project, error: projectError } = await adminClient
    .from("projects")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const insertPayload = {
    project_id: id,
    touchpoint_type: body.touchpoint_type,
    entity_id: body.entity_id,
    entity_table: body.entity_table,
    occurred_at: body.occurred_at ?? new Date().toISOString(),
    note: body.note ?? null,
  };

  const { data, error } = await adminClient
    .from("project_touchpoints")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
