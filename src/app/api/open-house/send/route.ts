// POST /api/open-house/send  { blastId, test?: boolean }
// Authed. This is the runtime gate: a real send happens only when this route
// is invoked (the preview "Approve and send" button). Returns the send summary.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { sendBlast } from "@/lib/open-house/sender";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { blastId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const blastId = body.blastId;
  if (!blastId) return NextResponse.json({ error: "blastId required" }, { status: 400 });

  // Ownership check.
  const { data: blast } = await adminClient
    .from("open_house_blasts")
    .select("id, user_id")
    .eq("id", blastId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!blast) return NextResponse.json({ error: "blast not found" }, { status: 404 });
  if (blast.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const summary = await sendBlast({ blastId, actorUserId: user.id });
  const status = summary.ok ? 200 : 422;
  return NextResponse.json(summary, { status });
}
