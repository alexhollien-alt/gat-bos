/* eslint-disable no-restricted-syntax -- Inline hex colors and HTML numeric
   character references are required for email-rendered HTML. Email clients do
   not support CSS variables or external stylesheets; colors must be inlined
   per email-design conventions. The rule's regex also matches entities like
   &#039; which are not hex colors. Scoped to this file only. */
// Berneil broker-open RSVP daily summary cron.
//
// Runs 0 15 * * * UTC (8:00 AM MST in Phoenix; Arizona has no DST, so
// MST is UTC-7 year-round). Emails Alex a one-glance RSVP digest for the
// May 29 2026 Berneil broker open.
//
// Auth: Bearer CRON_SECRET (verifyCronSecret).
// Recipient: ahollien@azgat.com (Alex only for the first few days; Denise is
//   deliberately NOT on the to-list yet -- Alex adds her after he sees the
//   response rate himself).
// From: alex@alexhollienco.com (verified Resend sender domain).
//
// Lifecycle: the event is 2026-05-29. The cron self-retires after
//   2026-05-30 -- on or after 2026-05-31 (Phoenix date) it returns 200
//   without sending so the schedule can be removed at leisure.
//
// Schema notes (verified against live migrations):
//   - event_rsvps has NO slug column. The event is resolved via
//     public_events.slug = 'berneil', then RSVPs filtered by event_id.
//   - event_rsvps has NO contact_id column. brokerage is denormalized
//     directly onto each RSVP row at submit time, so no contacts join.
//   - guest_count is TOTAL party size (CHECK BETWEEN 1 AND 2): 1 = just
//     them, 2 = them + 1 guest. Headcount = SUM(guest_count), no +1.

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { adminClient } from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/api-auth";
import { logError } from "@/lib/error-log";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ROUTE = "/api/cron/berneil-rsvp-summary";
const EVENT_SLUG = "berneil";
const FROM = "Alex Hollien <alex@alexhollienco.com>";
const TO = "ahollien@azgat.com";
const RSVP_URL = "https://gat-bos.vercel.app/rsvp/berneil";
// Self-retire on or after this Phoenix date (event is 2026-05-29).
const RETIRE_AFTER = "2026-05-30";

interface RsvpRow {
  name: string;
  guest_count: number;
  brokerage: string | null;
  created_at: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Phoenix-local date as YYYY-MM-DD (en-CA yields ISO ordering).
function phoenixDateString(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Phoenix",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildHtml(params: {
  rows: RsvpRow[];
  total: number;
  headcount: number;
  newCount: number;
  newCutoffIso: string;
  asOfLabel: string;
}): string {
  const { rows, total, headcount, newCount, newCutoffIso, asOfLabel } = params;

  const summaryLine =
    total === 0
      ? "No RSVPs yet. The page is live and waiting."
      : `${total} confirmed &middot; ~${headcount} expected headcount &middot; ${newCount} new since yesterday`;

  const rowsHtml =
    total === 0
      ? `<tr><td colspan="4" style="padding:24px 16px;text-align:center;color:#8a8a82;font-size:14px;">No reservations recorded yet.</td></tr>`
      : rows
          .map((r) => {
            const isNew = r.created_at > newCutoffIso;
            const rowBg = isNew ? "#f4efe4" : "#ffffff";
            const badge = isNew
              ? ` <span style="display:inline-block;background:#9a7b3f;color:#ffffff;font-size:10px;font-weight:700;letter-spacing:0.06em;padding:2px 7px;border-radius:10px;vertical-align:middle;">NEW</span>`
              : "";
            const brokerage = r.brokerage ? escapeHtml(r.brokerage) : "--";
            return `<tr style="background:${rowBg};">
  <td style="padding:11px 16px;border-bottom:1px solid #ece8df;font-size:14px;color:#1f1d18;font-weight:600;">${escapeHtml(r.name)}${badge}</td>
  <td style="padding:11px 16px;border-bottom:1px solid #ece8df;font-size:14px;color:#4a463d;text-align:center;">${r.guest_count}</td>
  <td style="padding:11px 16px;border-bottom:1px solid #ece8df;font-size:13px;color:#6b675c;white-space:nowrap;">${escapeHtml(formatWhen(r.created_at))}</td>
  <td style="padding:11px 16px;border-bottom:1px solid #ece8df;font-size:13px;color:#4a463d;">${brokerage}</td>
</tr>`;
          })
          .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Berneil RSVP Summary</title>
</head>
<body style="margin:0;padding:0;background:#f5f2ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ea;padding:28px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(31,29,24,0.06);">

  <tr><td style="background:#1f1d18;padding:26px 28px;">
    <div style="color:#c9a86a;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Daily RSVP Report</div>
    <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:6px;">An Evening at Berneil</div>
    <div style="color:#9b9788;font-size:13px;margin-top:4px;">Private Broker Preview &middot; Thu, May 29 &middot; 4901 E Berneil Dr, Paradise Valley</div>
  </td></tr>

  <tr><td style="padding:22px 28px 6px;">
    <div style="font-size:15px;color:#1f1d18;font-weight:600;line-height:1.5;">${summaryLine}</div>
    <div style="font-size:12px;color:#9b9788;margin-top:4px;">As of ${escapeHtml(asOfLabel)}</div>
  </td></tr>

  <tr><td style="padding:14px 20px 4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #ece8df;border-radius:10px;overflow:hidden;">
      <tr style="background:#1f1d18;">
        <th align="left" style="padding:10px 16px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#c9a86a;font-weight:700;">Name</th>
        <th align="center" style="padding:10px 16px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#c9a86a;font-weight:700;">Guests</th>
        <th align="left" style="padding:10px 16px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#c9a86a;font-weight:700;">When</th>
        <th align="left" style="padding:10px 16px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#c9a86a;font-weight:700;">Brokerage</th>
      </tr>
      ${rowsHtml}
    </table>
  </td></tr>

  <tr><td style="padding:18px 28px 26px;">
    <a href="${RSVP_URL}" style="color:#9a7b3f;font-size:14px;font-weight:600;text-decoration:none;">View the RSVP page &rarr;</a>
    <div style="font-size:11px;color:#b7b3a6;margin-top:14px;line-height:1.5;">Automated daily summary &middot; ${RSVP_URL}</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

async function handleRun(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const now = new Date();

  // Lifecycle: self-retire after the event window.
  if (phoenixDateString(now) > RETIRE_AFTER) {
    return NextResponse.json({
      ok: true,
      sent: false,
      retired: true,
      message: "post-event, cron retired",
    });
  }

  // Resolve the Berneil event (slug lives on public_events, not event_rsvps).
  const { data: event, error: eventErr } = await adminClient
    .from("public_events")
    .select("id")
    .eq("slug", EVENT_SLUG)
    .is("deleted_at", null)
    .maybeSingle();

  if (eventErr) {
    await logError(ROUTE, `event lookup failed: ${eventErr.message}`, {});
    return NextResponse.json({ ok: false, error: eventErr.message }, { status: 500 });
  }
  if (!event) {
    await logError(ROUTE, `no public_event with slug '${EVENT_SLUG}'`, {});
    return NextResponse.json(
      { ok: false, error: "event_not_found", slug: EVENT_SLUG },
      { status: 200 },
    );
  }

  // Pull RSVPs, most recent first. brokerage is denormalized onto the row.
  const { data, error: rsvpErr } = await adminClient
    .from("event_rsvps")
    .select("name, guest_count, brokerage, created_at")
    .eq("event_id", event.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (rsvpErr) {
    await logError(ROUTE, `rsvp query failed: ${rsvpErr.message}`, {});
    return NextResponse.json({ ok: false, error: rsvpErr.message }, { status: 500 });
  }

  const rows = (data ?? []) as RsvpRow[];
  const total = rows.length;
  const headcount = rows.reduce((sum, r) => sum + (r.guest_count ?? 1), 0);
  const newCutoffIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const newCount = rows.filter((r) => r.created_at > newCutoffIso).length;

  const asOfLabel = now.toLocaleString("en-US", {
    timeZone: "America/Phoenix",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const subject = `Berneil RSVPs: ${total} confirmed, ~${headcount} expected headcount`;
  const html = buildHtml({ rows, total, headcount, newCount, newCutoffIso, asOfLabel });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await logError(ROUTE, "RESEND_API_KEY not set; cannot send summary", {});
    return NextResponse.json(
      { ok: false, error: "resend_not_configured", total, headcount },
      { status: 500 },
    );
  }

  const resend = new Resend(apiKey);
  const { data: sendData, error: sendErr } = await resend.emails.send({
    from: FROM,
    to: [TO],
    subject,
    html,
  });

  if (sendErr) {
    await logError(ROUTE, `resend send failed: ${sendErr.message}`, { total, headcount });
    return NextResponse.json(
      { ok: false, error: sendErr.message, total, headcount },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    messageId: sendData?.id ?? null,
    total,
    headcount,
    newSinceYesterday: newCount,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await handleRun(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "berneil-rsvp-summary failed";
    await logError(ROUTE, `unhandled: ${message}`, {});
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
