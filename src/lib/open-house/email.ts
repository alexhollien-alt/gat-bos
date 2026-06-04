// src/lib/open-house/email.ts
// The open house blast email. Built deliberately LIGHT and text-forward to
// land in Primary, not Promotions:
//   - single column, ~600px, table layout, system font stack (reads personal)
//   - one listing photo, one button, everything else is real text
//   - renders fully useful with images blocked (all details are text)
//   - the rich visual experience lives on the landing page behind the button
//   - links point at the sending subdomain (PUBLIC_BASE_URL) so the click
//     target aligns with the From domain
//   - plain-text alternative is always generated (multipart = Primary signal)
//
// Agent branding = the agent's name, voice, and signature. The palette stays
// canonical (Email Exception: inline hex from design-tokens).

import { EMAIL_COLORS } from "./config";
import { formatBlastDate, formatTimeRange } from "./format";

const FRANCHISE_LINE_BROKERAGES = ["coldwell banker", "keller williams"];

export interface OpenHouseEmailAgent {
  name: string;
  firstName: string;
  brokerage: string | null;
  email: string | null;
  phone: string | null;
}

export interface OpenHouseEmailBlast {
  address: string;
  city: string;
  state: string | null;
  price: string | null;
  openHouseDate: string; // ISO date "2026-06-14"
  openHouseStart: string | null; // "13:00:00"
  openHouseEnd: string | null;
  details: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  heroImageUrl: string | null;
  subjectOverride?: string | null;
}

export interface OpenHouseEmailParams {
  recipientFirstName: string;
  agent: OpenHouseEmailAgent;
  blast: OpenHouseEmailBlast;
  landingUrl: string;
  unsubscribeUrl: string;
  footerAddress: string; // CAN-SPAM physical postal address
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function specLine(blast: OpenHouseEmailBlast): string | null {
  const parts: string[] = [];
  if (blast.beds != null) parts.push(`${blast.beds} bd`);
  if (blast.baths != null) parts.push(`${blast.baths} ba`);
  if (blast.sqft != null) parts.push(`${blast.sqft.toLocaleString("en-US")} sq ft`);
  return parts.length ? parts.join("  /  ") : null;
}

export function buildSubject(blast: OpenHouseEmailBlast): string {
  if (blast.subjectOverride && blast.subjectOverride.trim()) {
    return blast.subjectOverride.trim();
  }
  const { weekday } = formatBlastDate(blast.openHouseDate);
  return `${weekday} open house in ${blast.city}`;
}

export function buildOpenHouseEmail(params: OpenHouseEmailParams): BuiltEmail {
  const { recipientFirstName, agent, blast, landingUrl, unsubscribeUrl, footerAddress } = params;
  const C = EMAIL_COLORS;
  const dates = formatBlastDate(blast.openHouseDate);
  const timeLabel = formatTimeRange(blast.openHouseStart, blast.openHouseEnd);
  const specs = specLine(blast);
  const subject = buildSubject(blast);
  const cityState = [blast.city, blast.state].filter(Boolean).join(", ");
  const preheader = `${agent.firstName} is hosting an open house at ${blast.address}. Details and directions inside.`;

  const showFranchise =
    !!agent.brokerage &&
    FRANCHISE_LINE_BROKERAGES.includes(agent.brokerage.trim().toLowerCase());

  // ----- detail rows (text, readable images-off) -----
  const detailRows: string[] = [];
  detailRows.push(
    `<div style="font-size:17px;line-height:1.5;color:${C.structure};font-weight:bold;">${esc(blast.address)}</div>`,
  );
  detailRows.push(
    `<div style="font-size:15px;line-height:1.5;color:${C.structure};">${esc(cityState)}</div>`,
  );
  detailRows.push(
    `<div style="font-size:15px;line-height:1.6;color:${C.structure};margin-top:10px;">${esc(dates.dateLabel)}${timeLabel ? `, ${esc(timeLabel)}` : ""}</div>`,
  );
  if (blast.price) {
    detailRows.push(
      `<div style="font-size:15px;line-height:1.6;color:${C.structure};">Offered at ${esc(blast.price)}</div>`,
    );
  }
  if (specs) {
    detailRows.push(
      `<div style="font-size:14px;line-height:1.6;color:${C.structure};opacity:0.8;">${esc(specs)}</div>`,
    );
  }

  const heroBlock = blast.heroImageUrl
    ? `
      <tr>
        <td style="padding:0 0 24px 0;">
          <a href="${esc(landingUrl)}" style="text-decoration:none;">
            <img src="${esc(blast.heroImageUrl)}" width="600" alt="${esc(blast.address)}"
                 style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;border-radius:4px;" />
          </a>
        </td>
      </tr>`
    : "";

  const detailsParagraph = blast.details
    ? `
      <tr>
        <td style="padding:0 0 24px 0;font-size:15px;line-height:1.6;color:${C.structure};">
          ${esc(blast.details)}
        </td>
      </tr>`
    : "";

  // ----- button (Signal bg, Structure text) with Outlook VML fallback -----
  const button = `
    <tr>
      <td style="padding:4px 0 28px 0;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
          href="${esc(landingUrl)}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="8%"
          strokecolor="${C.signal}" fillcolor="${C.signal}">
          <w:anchorlock/>
          <center style="color:${C.structure};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">See the full listing</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <a href="${esc(landingUrl)}"
           style="display:inline-block;background:${C.signal};color:${C.structure};font-size:16px;font-weight:bold;
                  text-decoration:none;padding:14px 32px;border-radius:4px;">
          See the full listing
        </a>
        <!--<![endif]-->
        <div style="font-size:13px;line-height:1.6;color:${C.structure};opacity:0.7;margin-top:12px;">
          Or open it here: <a href="${esc(landingUrl)}" style="color:${C.structure};">${esc(landingUrl)}</a>
        </div>
      </td>
    </tr>`;

  const signature = `
    <tr>
      <td style="padding:8px 0 0 0;font-size:15px;line-height:1.6;color:${C.structure};">
        Stop by, bring a client, or just come say hello. I would love to see you there.
        <div style="margin-top:18px;">
          <div style="font-weight:bold;">${esc(agent.name)}</div>
          ${agent.brokerage ? `<div style="opacity:0.85;">${esc(agent.brokerage)}</div>` : ""}
          ${agent.phone ? `<div style="opacity:0.85;">${esc(agent.phone)}</div>` : ""}
          ${agent.email ? `<div style="opacity:0.85;"><a href="mailto:${esc(agent.email)}" style="color:${C.structure};">${esc(agent.email)}</a></div>` : ""}
        </div>
      </td>
    </tr>`;

  // ----- footer: compliance trio (no GAT logo on digital), postal, unsub -----
  const base = landingUrl.replace(/\/open-house\/.*$/, "");
  const footer = `
    <tr>
      <td style="padding:28px 0 0 0;border-top:1px solid rgba(25,42,86,0.12);">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-right:14px;vertical-align:middle;">
              <img src="${esc(base)}/email-assets/compliance/mls-realtor-logo.png" height="34" alt="MLS Realtor"
                   style="display:block;height:34px;width:auto;border:0;" />
            </td>
            <td style="vertical-align:middle;">
              <img src="${esc(base)}/email-assets/compliance/equal-housing-opportunity.png" height="30" alt="Equal Housing Opportunity"
                   style="display:block;height:30px;width:auto;border:0;" />
            </td>
          </tr>
        </table>
        ${showFranchise ? `<div style="font-size:11px;line-height:1.5;color:${C.structure};opacity:0.6;font-style:italic;margin-top:12px;">EACH OFFICE IS INDEPENDENTLY OWNED AND OPERATED</div>` : ""}
        <div style="font-size:12px;line-height:1.6;color:${C.structure};opacity:0.6;margin-top:12px;">
          ${esc(footerAddress)}
        </div>
        <div style="font-size:12px;line-height:1.6;color:${C.structure};opacity:0.6;margin-top:8px;">
          You are receiving this because you are an agent in ${esc(blast.city)}.
          <a href="${esc(unsubscribeUrl)}" style="color:${C.structure};">Unsubscribe instantly</a>.
        </div>
      </td>
    </tr>`;

  const html = `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${esc(subject)}</title>
  <!--[if mso]><style>* { font-family: Arial, sans-serif !important; }</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${C.ground};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.ground};font-size:1px;line-height:1px;">
    ${esc(preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.ground};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:600px;max-width:600px;font-family:'PT Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
          <tr>
            <td style="padding:0 0 20px 0;font-size:16px;line-height:1.6;color:${C.structure};">
              Hi ${esc(recipientFirstName)},
              <div style="margin-top:14px;">
                I am hosting an open house at ${esc(blast.address)} this ${esc(dates.weekday)} and wanted to
                make sure you and your buyers had it on the calendar.
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 22px 0;">
              ${detailRows.join("\n              ")}
            </td>
          </tr>
          ${heroBlock}
          ${detailsParagraph}
          ${button}
          ${signature}
          ${footer}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ----- plain-text alternative -----
  const textLines = [
    `Hi ${recipientFirstName},`,
    ``,
    `I am hosting an open house at ${blast.address} this ${dates.weekday} and wanted to make sure you and your buyers had it on the calendar.`,
    ``,
    blast.address,
    cityState,
    `${dates.dateLabel}${timeLabel ? `, ${timeLabel}` : ""}`,
  ];
  if (blast.price) textLines.push(`Offered at ${blast.price}`);
  if (specs) textLines.push(specs);
  if (blast.details) textLines.push("", blast.details);
  textLines.push("", `See the full listing: ${landingUrl}`, "");
  textLines.push("Stop by, bring a client, or just come say hello. I would love to see you there.");
  textLines.push("", agent.name);
  if (agent.brokerage) textLines.push(agent.brokerage);
  if (agent.phone) textLines.push(agent.phone);
  if (agent.email) textLines.push(agent.email);
  textLines.push("", footerAddress);
  textLines.push("", `Unsubscribe instantly: ${unsubscribeUrl}`);

  return { subject, html, text: textLines.join("\n") };
}
