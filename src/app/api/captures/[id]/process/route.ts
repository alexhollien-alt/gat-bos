import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { promoteCapture } from "@/lib/captures/promote";
import type { Capture, CapturePayload } from "@/lib/types";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { extractIp } from "@/lib/rate-limit/extract-ip";

// Rate limit: 20 promotions per 60s sliding window per IP. Promotion is
// downstream of capture and tighter (LLM/Gmail/Calendar work fans out from
// a single click), so we cap a third lower than the captures POST limit.
const PROCESS_RATE_LIMIT = 20;
const PROCESS_RATE_WINDOW_SEC = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = extractIp(request.headers);
  const rl = await checkRateLimit(
    `ratelimit:captures-process:${ip}`,
    PROCESS_RATE_LIMIT,
    PROCESS_RATE_WINDOW_SEC,
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

  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: capture, error: fetchError } = await supabase
    .from("captures")
    .select(
      "id, user_id, raw_text, parsed_intent, parsed_contact_id, parsed_payload, processed, created_at, updated_at"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single<Capture>();

  if (fetchError || !capture) {
    return NextResponse.json(
      { error: fetchError?.message ?? "Capture not found" },
      { status: 404 }
    );
  }

  if (capture.processed) {
    const existingId = capture.parsed_payload?.promoted_id as string | undefined;
    const existingTo = capture.parsed_payload?.promoted_to as string | undefined;
    return NextResponse.json(
      {
        error: "Already processed",
        promoted_to: existingTo ?? null,
        promoted_id: existingId ?? null,
      },
      { status: 409 }
    );
  }

  const result = await promoteCapture({
    capture,
    userId: user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const promotedAt = new Date().toISOString();
  const mergedPayload: CapturePayload = {
    ...(capture.parsed_payload ?? {}),
    promoted_to: result.promotedTo,
    promoted_id: result.promotedId,
    promoted_at: promotedAt,
  };

  const { error: updateError } = await supabase
    .from("captures")
    .update({
      processed: true,
      parsed_payload: mergedPayload,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    id: capture.id,
    processed: true,
    promoted_to: result.promotedTo,
    promoted_id: result.promotedId,
    target_url: result.targetUrl,
  });
}
