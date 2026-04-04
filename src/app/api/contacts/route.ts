import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
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

  // Filter by temperature below threshold
  const tempBelow = params.get("temperature_below");
  if (tempBelow) {
    query = query.lt("temperature", parseInt(tempBelow, 10));
  }

  // Filter by stale contacts (last_touch_date older than N days)
  const staleDays = params.get("stale_days");
  if (staleDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(staleDays, 10));
    query = query.lt("last_touch_date", cutoff.toISOString());
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
  const body = await request.json();

  // Require at minimum a first_name
  if (!body.first_name) {
    return NextResponse.json(
      { error: "first_name is required" },
      { status: 400 }
    );
  }

  const { data, error } = await adminClient
    .from("contacts")
    .insert(body)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
