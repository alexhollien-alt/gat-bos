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

  // Strip user_id from body -- ownership is immutable via this endpoint.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user_id: _ignored, ...sanitized } = body;

  // Auto-set updated_at
  sanitized.updated_at = new Date().toISOString();

  const { data, error } = await adminClient
    .from("contacts")
    .update(sanitized)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}
