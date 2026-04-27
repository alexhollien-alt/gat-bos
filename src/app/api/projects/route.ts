import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireApiToken } from "@/lib/api-auth";
import { firePostCreationHooks } from "@/lib/hooks/post-creation";

const PROJECT_TYPES = [
  "agent_bd",
  "home_tour",
  "happy_hour",
  "campaign",
  "listing",
  "other",
] as const;

const PROJECT_STATUSES = ["active", "paused", "closed"] as const;

export async function GET(request: NextRequest) {
  const unauth = requireApiToken(request);
  if (unauth) return unauth;

  const params = request.nextUrl.searchParams;

  let query = adminClient
    .from("projects")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  const status = params.get("status");
  if (status && (PROJECT_STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status);
  }

  const type = params.get("type");
  if (type && (PROJECT_TYPES as readonly string[]).includes(type)) {
    query = query.eq("type", type);
  }

  const ownerContactId = params.get("owner_contact_id");
  if (ownerContactId) {
    query = query.eq("owner_contact_id", ownerContactId);
  }

  const limitParam = params.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 100;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const unauth = requireApiToken(request);
  if (unauth) return unauth;

  const body = await request.json();

  if (!body.type || !(PROJECT_TYPES as readonly string[]).includes(body.type)) {
    return NextResponse.json(
      { error: `type is required and must be one of: ${PROJECT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
    return NextResponse.json(
      { error: "title is required" },
      { status: 400 }
    );
  }
  if (body.status && !(PROJECT_STATUSES as readonly string[]).includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${PROJECT_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const insertPayload = {
    type: body.type,
    title: body.title.trim(),
    status: body.status ?? "active",
    owner_contact_id: body.owner_contact_id ?? null,
    metadata: body.metadata ?? {},
  };

  const { data, error } = await adminClient
    .from("projects")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire-and-forget: dispatch project-created hooks. Failures are logged
  // inside the dispatcher and never block project creation. Mirrors the
  // autoEnrollNewAgent contract used at contacts/route.ts:140-142.
  const ownerId = process.env.OWNER_USER_ID;
  if (data?.id && ownerId) {
    await firePostCreationHooks({
      entityKind: "project",
      entityId: data.id,
      payload: data,
      ownerUserId: ownerId,
    });
  }

  return NextResponse.json(data, { status: 201 });
}
