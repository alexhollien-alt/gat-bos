import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireApiToken } from "@/lib/api-auth";
import { writeEvent } from "@/lib/activity/writeEvent";

const PROJECT_STATUSES = ["active", "paused", "closed"] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = requireApiToken(request);
  if (unauth) return unauth;

  const { id } = await params;

  const { data, error } = await adminClient
    .from("projects")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = requireApiToken(request);
  if (unauth) return unauth;

  const { id } = await params;
  const body = await request.json();

  if (body.status && !(PROJECT_STATUSES as readonly string[]).includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${PROJECT_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    id: _ignoredId,
    deleted_at: _ignoredDeletedAt,
    created_at: _ignoredCreatedAt,
    type: _ignoredType,
    ...sanitized
  } = body;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  sanitized.updated_at = new Date().toISOString();

  const { data, error } = await adminClient
    .from("projects")
    .update(sanitized)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  // userId/actorId derived from projects.user_id (Slice 7A: column-based RLS).
  // contact_id not reliably available on project PATCH without additional context.
  // Slice 2 improvement: include contact_id in context for per-contact timeline indexing.
  if (data?.user_id) {
    void writeEvent({
      userId: data.user_id,
      actorId: data.user_id,
      verb: 'project.updated',
      object: { table: 'projects', id },
      context: { updated_fields: Object.keys(sanitized) },
    });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = requireApiToken(request);
  if (unauth) return unauth;

  const { id } = await params;

  const { data, error } = await adminClient
    .from("projects")
    .update({
      deleted_at: new Date().toISOString(),
      status: "closed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}
