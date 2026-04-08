// src/app/api/spine/inbox/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const parsedFilter = url.searchParams.get("parsed");

  let q = supabase
    .from("spine_inbox")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("captured_at", { ascending: false })
    .limit(limit);

  if (parsedFilter === "true") q = q.eq("parsed", true);
  else if (parsedFilter === "false") q = q.eq("parsed", false);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inbox: data ?? [] });
}
