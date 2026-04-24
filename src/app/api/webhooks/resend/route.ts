import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { logError } from "@/lib/error-log";

const ROUTE = "/api/webhooks/resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const SCORE_BUMPS: Record<string, number> = {
  "email.delivered": 1,
  "email.opened": 3,
  "email.clicked": 5,
};

// Replay protection: reject timestamps more than 5 minutes off.
const TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Verify a Svix-formatted webhook signature as used by Resend.
 *
 * Signed content: `${svix-id}.${svix-timestamp}.${rawBody}`
 * Header format:  `svix-signature: v1,<base64-hmac> [v1,<base64-hmac>...]`
 * Secret format:  `whsec_<base64>` (prefix stripped, remainder base64-decoded
 *                 to get the HMAC key bytes).
 *
 * All comparisons are timing-safe.
 */
function verifySvixSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): boolean {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const tsSeconds = Number(svixTimestamp);
  if (!Number.isFinite(tsSeconds)) return false;
  const tsMs = tsSeconds * 1000;
  if (Math.abs(Date.now() - tsMs) > TOLERANCE_MS) return false;

  const secretBody = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret;

  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(secretBody, "base64");
  } catch {
    return false;
  }
  if (keyBytes.length === 0) return false;

  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", keyBytes)
    .update(signedPayload)
    .digest();

  // svix-signature can carry multiple space-separated versioned entries.
  const candidates = svixSignature.split(" ");
  for (const candidate of candidates) {
    const commaIdx = candidate.indexOf(",");
    if (commaIdx < 0) continue;
    const version = candidate.slice(0, commaIdx);
    const sig = candidate.slice(commaIdx + 1);
    if (version !== "v1" || !sig) continue;

    let sigBuf: Buffer;
    try {
      sigBuf = Buffer.from(sig, "base64");
    } catch {
      continue;
    }
    if (sigBuf.length !== expected.length) continue;
    if (timingSafeEqual(sigBuf, expected)) return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      console.error("RESEND_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Read raw body ONCE for signature verification, then parse as JSON.
    const rawBody = await req.text();

    if (!verifySvixSignature(rawBody, req.headers, secret)) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const { type, data } = payload;

    if (!["email.delivered", "email.opened", "email.clicked"].includes(type)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const recipientEmail = data.to?.[0];
    if (!recipientEmail) return NextResponse.json({ ok: true, skipped: true });

    const { data: contact } = await supabase
      .from("contacts")
      .select("id, health_score, first_name, last_name, user_id")
      .eq("email", recipientEmail)
      .is("deleted_at", null)
      .single();

    if (!contact) return NextResponse.json({ ok: true, skipped: true, reason: "no matching contact" });

    const bump = SCORE_BUMPS[type] || 0;
    if (bump > 0) {
      await supabase
        .from("contacts")
        .update({ health_score: Math.min((contact.health_score || 0) + bump, 100) })
        .eq("id", contact.id);
    }

    if (type === "email.opened" || type === "email.clicked") {
      const summary = type === "email.opened"
        ? `Opened: ${data.subject}`
        : `Clicked link in: ${data.subject}`;

      // Write to interactions_legacy -- views are not insertable
      await supabase.from("interactions_legacy").insert({
        user_id: contact.user_id,
        contact_id: contact.id,
        type: "email",
        summary,
        direction: "inbound",
      });
    }

    return NextResponse.json({ ok: true, contact_id: contact.id, bump });
  } catch (err) {
    const message = err instanceof Error ? err.message : "webhook processing failed";
    await logError(ROUTE, `webhook processing failed: ${message}`, {});
    return NextResponse.json({ error: "webhook processing failed" }, { status: 500 });
  }
}
