import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("morning_briefs")
    .select(
      "brief_date, generated_at, brief_text, brief_json, model, contacts_scored",
    )
    .is("deleted_at", null)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: `Brief lookup failed: ${error.message}` },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "No brief found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
