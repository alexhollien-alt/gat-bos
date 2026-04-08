// PATCH handles all quick actions: touched, skipped, deferred, rank changes.
// When touched, creates an interactions row so the trigger updates cycle_state.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FocusUpdate } from "@/lib/spine/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = FocusUpdate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "touched") {
    updates.touched_at = new Date().toISOString();
  }

  // Fetch the focus row first so we know the contact_id for interaction insert.
  const { data: existing, error: fetchErr } = await supabase
    .from("focus_queue")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("focus_queue")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If touched, insert an interaction so the trigger denorms cycle_state.
  if (parsed.data.status === "touched") {
    await supabase.from("interactions").insert({
      user_id: user.id,
      contact_id: existing.contact_id,
      type: parsed.data.touched_via ?? "other",
      note: `Touched via Today Command${parsed.data.outcome ? ` (${parsed.data.outcome})` : ""}`,
    });
  }

  return NextResponse.json({ focus: data });
}
