// src/app/api/spine/commitments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CommitmentCreate } from "@/lib/spine/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const contactId = url.searchParams.get("contact_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);

  let q = supabase
    .from("commitments")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (status) q = q.eq("status", status);
  if (contactId) q = q.eq("contact_id", contactId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ commitments: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = CommitmentCreate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("commitments")
    .insert({
      user_id: user.id,
      contact_id: parsed.data.contact_id ?? null,
      opportunity_id: parsed.data.opportunity_id ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      kind: parsed.data.kind ?? null,
      due_at: parsed.data.due_at ?? null,
      source: parsed.data.source,
      source_ref: parsed.data.source_ref ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ commitment: data }, { status: 201 });
}
