import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseCapture, type ContactIndexEntry } from "@/lib/captures/rules";
import { parseCaptureWithAI } from "@/lib/ai/capture-parse";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { extractIp } from "@/lib/rate-limit/extract-ip";

// Rate limit: 30 captures per 60s sliding window per IP. Captures are a
// burst-prone interaction (Alex pastes a sequence of meeting notes), so
// the window is short and the burst limit is generous compared to intake.
const CAPTURES_RATE_LIMIT = 30;
const CAPTURES_RATE_WINDOW_SEC = 60;

export async function POST(request: NextRequest) {
  const ip = extractIp(request.headers);
  const rl = await checkRateLimit(
    `ratelimit:captures:${ip}`,
    CAPTURES_RATE_LIMIT,
    CAPTURES_RATE_WINDOW_SEC,
  );
  if (!rl.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000),
    );
    return NextResponse.json(
      { error: "rate_limited", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { raw_text?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = typeof body.raw_text === "string" ? body.raw_text.trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "raw_text is required" }, { status: 400 });
  }

  const { data: contacts, error: contactsErr } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .is("deleted_at", null);

  if (contactsErr) {
    return NextResponse.json(
      { error: `Contacts lookup failed: ${contactsErr.message}` },
      { status: 500 }
    );
  }

  const index: ContactIndexEntry[] = (contacts ?? []).map((c) => ({
    id: c.id,
    first_name: c.first_name ?? "",
    last_name: c.last_name ?? "",
  }));

  // Slice 6: opt-in AI intent parser. Default off; rule parser stays primary
  // until the flag flips after a 7-day soak (see LATER.md).
  const aiEnabled = process.env.CAPTURES_AI_PARSE === "true";
  const parsed = aiEnabled
    ? await parseCaptureWithAI({ rawText: raw, contactsIndex: index })
    : parseCapture({ rawText: raw, contactsIndex: index });

  const { data, error } = await supabase
    .from("captures")
    .insert({
      user_id: user.id,
      raw_text: raw,
      parsed_intent: parsed.intent,
      parsed_contact_id: parsed.contactId,
      parsed_payload: parsed.payload,
      processed: false,
    })
    .select("id, raw_text, parsed_intent, parsed_contact_id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("captures")
    .select(
      "id, raw_text, parsed_intent, parsed_contact_id, parsed_payload, processed, created_at, contacts:parsed_contact_id(id, first_name, last_name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
