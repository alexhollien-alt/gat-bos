import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiToken } from "@/lib/api-auth";
import { SignalCreate } from "@/lib/spine/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "active";
  const severity = url.searchParams.get("severity");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);

  let q = supabase
    .from("signals")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", status)
    .is("deleted_at", null)
    .order("severity", { ascending: false })
    .order("detected_at", { ascending: false })
    .limit(limit);

  if (severity) q = q.eq("severity", severity);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signals: data ?? [] });
}

export async function POST(request: NextRequest) {
  // Accept session OR bearer (for cron/scout pushes)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  if (!userId) {
    const unauth = requireApiToken(request);
    if (unauth) return unauth;
    // For bearer-auth writes, must include user_id in body.
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = SignalCreate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // If bearer-auth, body must supply target user_id.
  const targetUserId = userId ?? (body as { user_id?: string }).user_id;
  if (!targetUserId) {
    return NextResponse.json(
      { error: "Bearer auth requires user_id in body" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("signals")
    .insert({
      user_id: targetUserId,
      contact_id: parsed.data.contact_id ?? null,
      opportunity_id: parsed.data.opportunity_id ?? null,
      kind: parsed.data.kind,
      severity: parsed.data.severity,
      title: parsed.data.title,
      detail: parsed.data.detail ?? null,
      window_start: parsed.data.window_start ?? null,
      window_end: parsed.data.window_end ?? null,
      suggested_action: parsed.data.suggested_action ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signal: data }, { status: 201 });
}
