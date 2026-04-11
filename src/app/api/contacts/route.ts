import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireApiToken } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const unauth = requireApiToken(request);
  if (unauth) return unauth;

  const params = request.nextUrl.searchParams;

  let query = adminClient
    .from("contacts")
    .select("*")
    .is("deleted_at", null)
    .order("last_name", { ascending: true });

  // Search by name (fuzzy match on first or last name)
  const name = params.get("name");
  if (name) {
    query = query.or(
      `first_name.ilike.%${name}%,last_name.ilike.%${name}%`
    );
  }

  // Filter by tier
  const tier = params.get("tier");
  if (tier) {
    query = query.eq("tier", tier);
  }

  // Filter by stage
  const stage = params.get("stage");
  if (stage) {
    query = query.eq("stage", stage);
  }

  // Filter by health score below threshold
  const scoreBelow = params.get("health_score_below");
  if (scoreBelow) {
    query = query.lt("health_score", parseInt(scoreBelow, 10));
  }

  // Filter by stale contacts (last_touchpoint older than N days)
  const staleDays = params.get("stale_days");
  if (staleDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(staleDays, 10));
    query = query.lt("last_touchpoint", cutoff.toISOString());
  }

  // Exclude contacts with specific tags (e.g., lender-partner, gat-internal)
  const excludeTag = params.get("exclude_tag");
  if (excludeTag) {
    query = query.not("tags", "cs", `["${excludeTag}"]`);
  }

  // Limit
  const limit = params.get("limit");
  query = query.limit(limit ? parseInt(limit, 10) : 200);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const unauth = requireApiToken(request);
  if (unauth) return unauth;

  // Hard-pinned owner. Same env var as /api/intake. Must be a valid
  // auth.users.id. Single-user system today; replace with session-derived
  // ownership when multi-user is added.
  const ownerId = process.env.OWNER_USER_ID;
  if (!ownerId) {
    return NextResponse.json(
      { error: "Server misconfigured: OWNER_USER_ID not set" },
      { status: 500 }
    );
  }

  const body = await request.json();

  // Require at minimum a first_name
  if (!body.first_name) {
    return NextResponse.json(
      { error: "first_name is required" },
      { status: 400 }
    );
  }

  // Owner-stamp: ignore any user_id supplied in the body, always use the
  // canonical owner. Phase 2.1 is single-user; this prevents a future
  // multi-user mistake from leaking writes across owners.
  // Also strip dead fields that earlier schemas exposed but the live DB
  // does not have: lead_status (covered by stage), company (covered by
  // brokerage), source_detail. Silent ignore so external clients don't 500
  // when they send the old field names.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    user_id: _ignored,
    lead_status: _ignoredLeadStatus,
    company: _ignoredCompany,
    source_detail: _ignoredSourceDetail,
    ...sanitized
  } = body;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const insertPayload = { ...sanitized, user_id: ownerId };

  const { data, error } = await adminClient
    .from("contacts")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
