// src/app/api/spine/capture/route.ts
// Accepts raw text (from dashboard bar, mobile capture, voice, etc.)
// and writes it to spine_inbox unparsed. Parser cron picks it up later.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CaptureInput } from "@/lib/spine/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CaptureInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { raw_text, source, source_ref } = parsed.data;

  const { data, error } = await supabase
    .from("spine_inbox")
    .insert({
      user_id: user.id,
      raw_text,
      source,
      source_ref: source_ref ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inbox: data }, { status: 201 });
}
