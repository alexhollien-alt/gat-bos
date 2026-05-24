import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { writeEvent } from "@/lib/activity/writeEvent";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { extractIp } from "@/lib/rate-limit/extract-ip";
import { rsvpSubmitSchema } from "@/lib/rsvp/schema";
import { sendRsvpConfirmation } from "@/lib/rsvp/send-confirmation";
import { logError } from "@/lib/error-log";

// Public, unauthenticated RSVP submission endpoint.
//
// Form collects only Name + Guest count. Email/brokerage/phone are sourced
// from a separate CSV upload via the contacts table -- after submit, we
// look up the contact by name (case-insensitive) and, if matched, send a
// confirmation email to that contact's address. If no match, we still
// record the RSVP and surface success; the operator can reconcile later
// when the CSV import completes.
//
// Rate limit: 5 submissions per IP per hour. Sized for a real person filling
// the form once; well below normal use. Fails open on Supabase error.

const ROUTE = "api/rsvp/submit";
const RSVP_RATE_LIMIT = 5;
const RSVP_RATE_WINDOW_SEC = 60 * 60;

interface HostContact {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
}

interface MatchedContact {
  id: string;
  email: string | null;
  brokerage: string | null;
}

// Best-effort contact lookup by submitted name. Case-insensitive match on
// `full_name`. Falls back to first+last concat if full_name is null.
// Returns the unique match or null if zero / multiple hits.
async function findContactByName(name: string): Promise<MatchedContact | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data, error } = await adminClient
    .from("contacts")
    .select("id, email, brokerage, full_name, first_name, last_name")
    .ilike("full_name", trimmed)
    .is("deleted_at", null)
    .limit(2);
  if (error || !data || data.length === 0) {
    // Fall back to first+last concat match.
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) return null;
    const first = parts[0];
    const last = parts.slice(1).join(" ");
    const { data: alt } = await adminClient
      .from("contacts")
      .select("id, email, brokerage, first_name, last_name")
      .ilike("first_name", first)
      .ilike("last_name", last)
      .is("deleted_at", null)
      .limit(2);
    if (!alt || alt.length !== 1) return null;
    return { id: alt[0].id, email: alt[0].email, brokerage: alt[0].brokerage };
  }
  if (data.length !== 1) return null;
  return { id: data[0].id, email: data[0].email, brokerage: data[0].brokerage };
}

export async function POST(request: Request) {
  try {
    const ip = extractIp(request.headers);
    const rl = await checkRateLimit(
      `ratelimit:rsvp:${ip}`,
      RSVP_RATE_LIMIT,
      RSVP_RATE_WINDOW_SEC,
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

    const rawBody = await request.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    const parsed = rsvpSubmitSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_input", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const payload = parsed.data;

    // Honeypot short-circuit. Pretend success so bots don't probe.
    if (payload.honeypot && payload.honeypot.length > 0) {
      return NextResponse.json({ ok: true, id: randomUUID() }, { status: 201 });
    }

    // Resolve event + host contact in one round-trip. Host metadata flows
    // from contacts via host_contact_id FK -- single source of truth.
    const { data: event, error: eventErr } = await adminClient
      .from("public_events")
      .select(
        "id, slug, title, address, event_start, event_end, timezone, status, host_contact_id, host:contacts!host_contact_id(id, first_name, last_name, full_name, email, phone, brokerage)",
      )
      .eq("slug", payload.slug)
      .is("deleted_at", null)
      .maybeSingle();
    if (eventErr) {
      await logError(ROUTE, `event lookup failed: ${eventErr.message}`, {
        slug: payload.slug,
      });
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    if (!event) {
      return NextResponse.json({ error: "event_not_found" }, { status: 404 });
    }
    if (event.status === "closed") {
      return NextResponse.json({ error: "event_closed" }, { status: 410 });
    }
    if (event.status !== "live") {
      return NextResponse.json({ error: "event_not_open" }, { status: 410 });
    }

    // Resolve account owner for activity_events.user_id (RLS owner).
    const { data: acct } = await adminClient
      .from("accounts")
      .select("owner_user_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const ownerId = acct?.owner_user_id;
    if (!ownerId) {
      await logError(ROUTE, "no account owner resolvable", {
        slug: payload.slug,
      });
      return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
    }

    // Best-effort contact lookup. Used to backfill email + brokerage on the
    // event_rsvps row and to drive the confirmation send.
    const matched = await findContactByName(payload.name);

    // Persist RSVP. email/brokerage backfilled from matched contact when
    // available; both columns are nullable after the rsvp form simplification
    // migration.
    const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
    const { data: rsvp, error: insertErr } = await adminClient
      .from("event_rsvps")
      .insert({
        event_id: event.id,
        name: payload.name,
        brokerage: matched?.brokerage ?? null,
        email: matched?.email ?? null,
        phone: null,
        guest_count: payload.guestCount,
        notes: null,
        ip_address: ip,
        user_agent: userAgent,
      })
      .select("id")
      .single();
    if (insertErr || !rsvp) {
      await logError(ROUTE, `insert failed: ${insertErr?.message ?? "no row"}`, {
        slug: payload.slug,
        name: payload.name,
      });
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    const host = (event as unknown as { host: HostContact | null }).host;

    // Ledger entry. Object points at the host contact so the agent timeline
    // shows the RSVP under the host's record. If we matched the RSVP'er to a
    // contact, surface that linkage in context for downstream reconciliation.
    await writeEvent({
      userId: ownerId,
      actorId: ownerId,
      verb: "event.rsvp.received",
      object: host?.id
        ? { table: "contacts", id: host.id }
        : { table: "event_rsvps", id: rsvp.id },
      context: {
        event_id: event.id,
        event_slug: event.slug,
        host_contact_id: host?.id ?? null,
        rsvp_id: rsvp.id,
        rsvp_name: payload.name,
        rsvp_email: matched?.email ?? null,
        rsvp_brokerage: matched?.brokerage ?? null,
        matched_contact_id: matched?.id ?? null,
        guest_count: payload.guestCount,
      },
    });

    // Confirmation email (best-effort). Skipped if no contact matched the
    // submitted name -- reconciliation happens after the CSV import.
    if (host?.email && matched?.email) {
      const hostName =
        host.full_name?.trim() ||
        `${host.first_name} ${host.last_name}`.trim();
      const { messageId, error: sendErr } = await sendRsvpConfirmation({
        name: payload.name,
        email: matched.email,
        eventTitle: event.title,
        eventStart: new Date(event.event_start),
        eventEnd: new Date(event.event_end),
        address: event.address ?? "",
        timezone: event.timezone ?? "America/Phoenix",
        hostName,
        hostEmail: host.email,
        hostPhone: host.phone ?? undefined,
        guestCount: payload.guestCount,
      });
      if (messageId) {
        await adminClient
          .from("event_rsvps")
          .update({ confirmation_message_id: messageId })
          .eq("id", rsvp.id);
      } else if (sendErr) {
        await logError(ROUTE, `confirmation send failed: ${sendErr}`, {
          rsvp_id: rsvp.id,
          email: matched.email,
          event_slug: event.slug,
        });
      }
    }

    return NextResponse.json({ ok: true, id: rsvp.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logError(ROUTE, `unhandled error: ${message}`, {});
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
