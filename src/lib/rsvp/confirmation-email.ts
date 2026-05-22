// Builds the RSVP confirmation email HTML + .ics attachment.
//
// Aesthetic mirrors the Berneil broker open invitation:
//   bone #F5F0E8 canvas, deep desert #1F1B16 ink, terracotta #9B6B4A accent,
//   Cormorant Garamond (web link) + Georgia fallback for display type,
//   Helvetica + Arial for body.
//
// Inputs are pre-validated by the API route; this module assumes safe strings.

export interface ConfirmationInput {
  name: string;
  email: string;
  eventTitle: string;
  eventStart: Date;
  eventEnd: Date;
  address: string;
  timezone: string;
  hostName: string;
  hostEmail: string;
  hostPhone?: string;
  guestCount: number;
}

const PHOENIX_TZ_LABEL = "Phoenix";

function formatDateLine(start: Date): string {
  const weekday = start.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "America/Phoenix",
  });
  const month = start.toLocaleDateString("en-US", {
    month: "long",
    timeZone: "America/Phoenix",
  });
  const day = start.toLocaleDateString("en-US", {
    day: "numeric",
    timeZone: "America/Phoenix",
  });
  return `${weekday}, ${month} ${day}`.toUpperCase();
}

function formatTimeRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Phoenix",
        hour12: true,
      })
      .replace(":00", "")
      .replace(/\s?(AM|PM)/i, (m) => m.trim().toUpperCase());
  return `${fmt(start)} TO ${fmt(end)}`;
}

export function buildConfirmationSubject(input: ConfirmationInput): string {
  return `You're confirmed for ${input.eventTitle}`;
}

export function buildConfirmationHtml(input: ConfirmationInput): string {
  const dateLine = formatDateLine(input.eventStart);
  const timeLine = formatTimeRange(input.eventStart, input.eventEnd);
  const mapHref = `https://maps.google.com/?q=${encodeURIComponent(input.address)}`;
  const guestNote =
    input.guestCount === 2
      ? "You and a guest are on the list."
      : "You're on the list.";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(buildConfirmationSubject(input))}</title>
</head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:Helvetica,Arial,sans-serif;color:#1F1B16;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F0E8;">
  <tr>
    <td align="center" style="padding:48px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#F5F0E8;">

        <tr><td align="center" style="padding:8px 32px 32px 32px;">
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(31,27,22,0.7);font-weight:600;">Broker Open</div>
        </td></tr>

        <tr><td align="center" style="padding:0 32px 24px 32px;">
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:32px;line-height:1.1;color:#1F1B16;">
            ${escapeHtml(input.eventTitle)}
          </div>
        </td></tr>

        <tr><td align="center" style="padding:0 32px 8px 32px;">
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1F1B16;">${guestNote}</div>
        </td></tr>

        <tr><td align="center" style="padding:0 32px 32px 32px;">
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:rgba(31,27,22,0.85);">
            ${escapeHtml(input.hostName)} looks forward to seeing you ${dateLine.split(",")[0].toLowerCase()}.
          </div>
        </td></tr>

        <tr><td style="padding:0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(155,107,74,0.4);border-bottom:1px solid rgba(155,107,74,0.4);">
            <tr><td align="center" style="padding:24px 16px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(31,27,22,0.7);">${escapeHtml(dateLine)}</div>
              <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;line-height:1.2;color:#1F1B16;margin-top:6px;">${escapeHtml(timeLine)}</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.08em;color:rgba(31,27,22,0.8);margin-top:10px;">${escapeHtml(input.address)}</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:rgba(31,27,22,0.7);margin-top:6px;">${PHOENIX_TZ_LABEL} time</div>
            </td></tr>
          </table>
        </td></tr>

        <tr><td align="center" style="padding:24px 32px 8px 32px;">
          <a href="${mapHref}" style="font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#1F1B16;text-decoration:underline;">Open in Maps</a>
          <span style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:rgba(31,27,22,0.4);margin:0 12px;">·</span>
          <span style="font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(31,27,22,0.85);">Calendar invite attached</span>
        </td></tr>

        <tr><td align="center" style="padding:32px 32px 0 32px;">
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.7;color:rgba(31,27,22,0.7);">
            If your plans change, reply to this email so ${escapeHtml(input.hostName.split(" ")[0] || input.hostName)} can update the list.
          </div>
        </td></tr>

        <tr><td style="padding:32px 32px 16px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="border-top:1px solid rgba(31,27,22,0.12);padding-top:24px;">
              <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;color:#1F1B16;">${escapeHtml(input.hostName)}</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:rgba(31,27,22,0.7);margin-top:4px;">
                <a href="mailto:${escapeHtml(input.hostEmail)}" style="color:rgba(31,27,22,0.85);text-decoration:none;">${escapeHtml(input.hostEmail)}</a>${
                  input.hostPhone
                    ? `<span style="margin:0 8px;">·</span><a href="tel:${escapeHtml(input.hostPhone.replace(/\D/g, ""))}" style="color:rgba(31,27,22,0.85);text-decoration:none;">${escapeHtml(input.hostPhone)}</a>`
                    : ""
                }
              </div>
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function buildConfirmationText(input: ConfirmationInput): string {
  const dateLine = formatDateLine(input.eventStart);
  const timeLine = formatTimeRange(input.eventStart, input.eventEnd);
  const lines = [
    `You're confirmed for ${input.eventTitle}.`,
    "",
    `${dateLine}, ${timeLine} (${PHOENIX_TZ_LABEL} time)`,
    input.address,
    "",
    "Calendar invite attached.",
    "",
    `If your plans change, reply to this email so ${input.hostName.split(" ")[0] || input.hostName} can update the list.`,
    "",
    input.hostName,
    input.hostEmail,
    input.hostPhone ?? "",
  ];
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

// ICS (RFC 5545) calendar invite. Single VEVENT. America/Phoenix has no DST
// so we can safely emit floating local times stamped with TZID.
export function buildIcs(input: ConfirmationInput): string {
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const uid = `rsvp-${input.email.toLowerCase()}-${input.eventStart.getTime()}@gat-bos`;
  const dtStamp = fmt(new Date());
  const dtStart = fmt(input.eventStart);
  const dtEnd = fmt(input.eventEnd);
  const description = `RSVP confirmed for ${input.eventTitle}. Host: ${input.hostName} (${input.hostEmail}).`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GAT-BOS//RSVP//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcs(input.eventTitle)}`,
    `LOCATION:${escapeIcs(input.address)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `ORGANIZER;CN=${escapeIcs(input.hostName)}:mailto:${input.hostEmail}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
