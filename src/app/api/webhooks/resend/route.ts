import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { logError } from "@/lib/error-log";
import { writeEvent } from "@/lib/activity/writeEvent";

// NO RATE LIMIT (Slice 3A intentional decision).
//
// The Svix HMAC-SHA256 signature verification below IS the security
// boundary for this endpoint -- forged requests are rejected before any
// work happens. Adding an IP-based rate limit on top would risk dropping
// legitimate Resend delivery/open/click event bursts during normal email
// activity (e.g., a Weekly Edge send to ~25 partners can fan out to 75+
// webhook callbacks within seconds), creating gaps in the email
// engagement record without any security upside. Do not "fix" this by
// wiring checkRateLimit in.

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

// Slice 5A Task 8: map Resend webhook event names to message_event_type enum.
// Resend emits 'email.sent' on dispatch, 'email.delivered' when the upstream
// inbox accepts it, 'email.opened' / 'email.clicked' for engagement, and
// 'email.bounced' / 'email.complained' for terminal failures. Anything not
// in the map skips the message_events insert (we still 200-OK so Resend
// stops retrying).
const MESSAGE_EVENT_TYPE: Record<string, "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained"> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
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

    // Slice 5A Task 8: ingest the event into message_events first. The
    // status-sync trigger (Slice 5A Task 2) updates messages_log.status.
    // Unknown event names short-circuit; known events with a non-matching
    // provider_message_id log a warning and continue (legacy
    // /api/email/approve-and-send sends still flow through Resend without
    // a messages_log row -- see LATER.md "migrate approve-and-send to
    // sendMessage()" follow-up).
    const eventType = MESSAGE_EVENT_TYPE[type as keyof typeof MESSAGE_EVENT_TYPE];
    const providerMessageId =
      typeof data?.email_id === "string"
        ? data.email_id
        : typeof data?.message_id === "string"
          ? data.message_id
          : null;

    if (eventType && providerMessageId) {
      const { data: log } = await supabase
        .from("messages_log")
        .select("id")
        .eq("provider_message_id", providerMessageId)
        .is("deleted_at", null)
        .maybeSingle();

      if (log?.id) {
        const { error: insertErr } = await supabase
          .from("message_events")
          .insert({
            message_log_id: log.id,
            event_type: eventType,
            provider_message_id: providerMessageId,
            payload,
          });
        if (insertErr) {
          await logError(ROUTE, `message_events insert failed: ${insertErr.message}`, {
            providerMessageId,
            eventType,
          });
        }
      } else {
        // Not in messages_log -- could be a legacy /api/email/approve-and-send
        // send. Log + continue; do not 4xx (Resend retries on non-2xx).
        console.warn(
          `[resend-webhook] no messages_log row for provider_message_id=${providerMessageId} (event=${type})`,
        );
      }
    }

    // Existing per-contact side effects only apply for delivered/opened/clicked.
    if (!["email.delivered", "email.opened", "email.clicked"].includes(type)) {
      return NextResponse.json({ ok: true, skipped_contact_side_effect: true });
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

      void writeEvent({
        userId: contact.user_id,
        actorId: contact.user_id,
        verb: "interaction.email",
        object: { table: "contacts", id: contact.id },
        context: {
          contact_id: contact.id,
          type: "email",
          summary,
          direction: "inbound",
          source: "resend_webhook",
        },
      });
    }

    return NextResponse.json({ ok: true, contact_id: contact.id, bump });
  } catch (err) {
    const message = err instanceof Error ? err.message : "webhook processing failed";
    await logError(ROUTE, `webhook processing failed: ${message}`, {});
    return NextResponse.json({ error: "webhook processing failed" }, { status: 500 });
  }
}
