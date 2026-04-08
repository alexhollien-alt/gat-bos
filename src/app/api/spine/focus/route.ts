import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FocusCreate } from "@/lib/spine/types";
import { currentMondayISO } from "@/lib/spine/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const weekOf = url.searchParams.get("week_of") ?? currentMondayISO();
  const status = url.searchParams.get("status");

  let q = supabase
    .from("focus_queue")
    .select(`*, contact:contacts(id,first_name,last_name,email,phone,headshot_url,tier)`)
    .eq("user_id", user.id)
    .eq("week_of", weekOf)
    .is("deleted_at", null)
    .order("rank", { ascending: true });

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ focus_queue: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = FocusCreate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const weekOf = parsed.data.week_of ?? currentMondayISO();

  const { data, error } = await supabase
    .from("focus_queue")
    .insert({
      user_id: user.id,
      contact_id: parsed.data.contact_id,
      week_of: weekOf,
      rank: parsed.data.rank ?? null,
      reason: parsed.data.reason,
      reason_detail: parsed.data.reason_detail ?? null,
      suggested_action: parsed.data.suggested_action ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ focus: data }, { status: 201 });
}
