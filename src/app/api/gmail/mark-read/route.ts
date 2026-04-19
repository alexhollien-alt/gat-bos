// Phase 1.3.1 Phase 5 -- Mark a Gmail message read + archived after Resend send.
// POST { email_id }. Bearer CRON_SECRET. Looks up gmail_id from emails row,
// removes UNREAD + INBOX labels via Gmail API, flips emails.is_unread=false.
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { markReadAndArchive } from "@/lib/gmail/sync-client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ROUTE = "/api/gmail/mark-read";

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (auth.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function logError(
  endpoint: string,
  error_message: string,
  context: Record<string, unknown>,
  error_code?: number,
) {
  await adminClient
    .from("error_logs")
    .insert({ endpoint, error_code: error_code ?? null, error_message, context })
    .then(() => null, () => null);
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email_id?: string };
  try {
    body = (await request.json()) as { email_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const emailId = body.email_id;
  if (!emailId || typeof emailId !== "string") {
    return NextResponse.json({ error: "email_id is required" }, { status: 400 });
  }

  const { data: row, error: loadErr } = await adminClient
    .from("emails")
    .select("gmail_id")
    .eq("id", emailId)
    .maybeSingle<{ gmail_id: string }>();

  if (loadErr) {
    await logError(ROUTE, `email lookup failed: ${loadErr.message}`, { email_id: emailId });
    return NextResponse.json({ error: "Email lookup failed" }, { status: 500 });
  }
  if (!row?.gmail_id) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  try {
    await markReadAndArchive(row.gmail_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "gmail modify failed";
    await logError(ROUTE, `gmail modify failed: ${message}`, {
      email_id: emailId,
      gmail_id: row.gmail_id,
    });
    return NextResponse.json({ error: "Gmail modify failed" }, { status: 502 });
  }

  const { error: updateErr } = await adminClient
    .from("emails")
    .update({ is_unread: false, last_checked_at: new Date().toISOString() })
    .eq("id", emailId);

  if (updateErr) {
    await logError(ROUTE, `emails update failed: ${updateErr.message}`, { email_id: emailId });
    return NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email_id: emailId, gmail_id: row.gmail_id });
}
