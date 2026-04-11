import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireApiToken } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = requireApiToken(request);
  if (unauth) return unauth;

  const { id } = await params;

  const { data, error } = await adminClient
    .from("contacts")
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

  // Strip immutable/forbidden fields from the PATCH body:
  //   user_id     -- ownership is immutable via this endpoint
  //   deleted_at  -- cannot be cleared here; restoration is its own endpoint,
  //                  otherwise any external caller could resurrect archived
  //                  records by sending `{deleted_at: null}`
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    user_id: _ignoredUserId,
    deleted_at: _ignoredDeletedAt,
    ...sanitized
  } = body;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  // Auto-set updated_at
  sanitized.updated_at = new Date().toISOString();

  // Only allow updates to live (non-soft-deleted) rows.
  const { data, error } = await adminClient
    .from("contacts")
    .update(sanitized)
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
