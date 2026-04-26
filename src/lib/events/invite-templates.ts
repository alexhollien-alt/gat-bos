// Slice 3B Task 6d: events/invite-templates/ promoted to single file.
// Consolidated from 8 sub-files (types, shell, signature, 4 renderers, index)
// into one module. Public surface unchanged from the prior `index.ts`
// barrel; internal helpers remain module-private. Two consolidations applied
// to avoid identifier collisions:
//   - The four private `buildPlainText(...)` helpers in each renderer became
//     `buildHomeTourPlainText` / `buildClassDayPlainText` /
//     `buildContentDayPlainText` / `buildHappyHourPlainText`.
//   - Three identical `firstName(full)` helpers (one per renderer) collapsed
//     to a single shared module-private helper.
//
// Body otherwise verbatim. Source-of-truth spec:
// ~/.claude/plans/event-cycle-build.md Step 5 plan.

// ===========================================================================
// Types
// ===========================================================================

export type EventOwnerName =
  | "Christine McConnell"
  | "Stephanie Reid"
  | "Alex Hollien";

export type LenderFlag = "alex" | "stephanie" | "christine" | "none";

export interface InviteRenderResult {
  subject: string;
  html: string;
  text: string;
}

export interface InviteCommonInput {
  event_name: string;
  date: string; // human-readable, e.g. "Wednesday, May 6"
  time: string; // human-readable, e.g. "9:00am - 11:30am"
  location: string; // resolved address or "Venue TBD"
  host_name: EventOwnerName;
  lender_flag: LenderFlag;
}

export interface HomeTourInviteInput extends InviteCommonInput {
  rsvp_link?: string | null;
  notes?: string | null;
}

export interface ClassDayInviteInput extends InviteCommonInput {
  rsvp_link?: string | null;
  track_focus?: string | null; // e.g. "Pipeline track #1 -- Farming Strategy"
  notes?: string | null;
}

export interface ContentDayInviteInput extends InviteCommonInput {
  rsvp_link: string; // REQUIRED -- Step 6 slot-reservation page URL
  notes?: string | null;
}

export interface HappyHourInviteInput extends InviteCommonInput {
  rsvp_link?: string | null;
  notes?: string | null;
}

export class MissingRsvpLinkError extends Error {
  constructor(eventType: string) {
    super(
      `${eventType} invites require rsvp_link (Step 6 slot-reservation page). Pass a non-empty URL.`,
    );
    this.name = "MissingRsvpLinkError";
  }
}

// ===========================================================================
// Signature
// ===========================================================================

export interface SignatureBlock {
  sign_off: string; // e.g. "With warm regards,"
  names_line: string; // e.g. "Christine McConnell & Alex Hollien"
  roles_line: string; // e.g. "Christine McConnell, Nations Lending | Alex Hollien, Great American Title"
}

export function buildSignature(
  host_name: EventOwnerName,
  lender_flag: LenderFlag,
): SignatureBlock {
  if (lender_flag === "christine") {
    return {
      sign_off: "With warm regards,",
      names_line: "Christine McConnell & Alex Hollien",
      roles_line:
        "Christine McConnell, Nations Lending | Alex Hollien, Great American Title",
    };
  }

  if (lender_flag === "stephanie") {
    return {
      sign_off: "With warm regards,",
      names_line: "Stephanie Reid & Alex Hollien",
      roles_line:
        "Stephanie Reid, Gravity Home Loans | Alex Hollien, Great American Title",
    };
  }

  // lender_flag === 'none' (Alex solo, 85254 Home Tour)
  if (host_name !== "Alex Hollien") {
    throw new Error(
      `Invalid signature: lender_flag='none' requires host_name='Alex Hollien', got '${host_name}'`,
    );
  }

  return {
    sign_off: "With warm regards,",
    names_line: "Alex Hollien",
    roles_line: "Alex Hollien, Great American Title",
  };
}

// ===========================================================================
// Shared HTML shell + helpers (private)
// ===========================================================================

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600&display=swap";

const GAT_RED = "#b31a35";
const GAT_BLUE = "#003087";
const BLACK = "#0a0a0a";
const WHITE = "#ffffff";
const OFFWHITE = "#f7f7f5";
const RULE = "#e8e8e8";
const MUTED = "#666666";

const GAT_FOOTER =
  "Title &amp; Escrow Services Provided by Great American Title Agency";

interface ShellInput {
  subject: string; // passed through verbatim to the sendDraft subject line
  preheader: string; // hidden preview text
  eyebrow: string; // small uppercase label above the H1 (e.g. "MAY 6 | HOME TOUR")
  headline: string; // Instrument Serif display line
  subhead: string; // Inter body intro paragraph
  details: Array<{ label: string; value: string }>; // Date / Time / Location rows
  body_html: string; // free-form body (bullets, narrative) between details and CTA
  cta: CtaSpec;
  signature: SignatureBlock;
  agent_disclaimer?: string; // fine-print above footer (optional)
}

type CtaSpec =
  | { kind: "button"; label: string; href: string }
  | { kind: "reply"; reply_prompt: string }; // renders plain "Reply to RSVP" line

function renderShell(input: ShellInput): string {
  const detailsRows = input.details
    .map(
      (d) => `
      <tr>
        <td style="padding:6px 0;font-family:'Inter',Arial,sans-serif;font-size:13px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};width:90px;">${escape(d.label)}</td>
        <td style="padding:6px 0;font-family:'Inter',Arial,sans-serif;font-size:15px;color:${BLACK};line-height:1.5;">${escape(d.value)}</td>
      </tr>`,
    )
    .join("");

  const ctaBlock = renderCta(input.cta);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escape(input.subject)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${FONTS_HREF}" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:${OFFWHITE};font-family:'Inter',Arial,sans-serif;color:${BLACK};">
  <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">
    ${escape(input.preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${OFFWHITE};">
    <tr>
      <td align="center" style="padding:48px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:${WHITE};max-width:600px;">
          <tr>
            <td style="padding:40px 48px 8px 48px;">
              <div style="font-family:'Inter',Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${GAT_RED};">${escape(input.eyebrow)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 48px 0 48px;">
              <h1 style="margin:0;font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:36px;line-height:1.15;color:${BLACK};">${escape(input.headline)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 48px 8px 48px;">
              <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:16px;line-height:1.6;color:${BLACK};">${escape(input.subhead)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 48px 8px 48px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${RULE};border-bottom:1px solid ${RULE};width:100%;">
                <tr><td style="height:12px;"></td></tr>
                ${detailsRows}
                <tr><td style="height:12px;"></td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 48px 8px 48px;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.65;color:${BLACK};">
              ${input.body_html}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 48px 0 48px;">
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:36px 48px 4px 48px;">
              <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.65;color:${BLACK};">${escape(input.signature.sign_off)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 48px 0 48px;">
              <p style="margin:0;font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:22px;line-height:1.3;color:${BLACK};">${escape(input.signature.names_line)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 48px 40px 48px;">
              <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:13px;line-height:1.55;color:${MUTED};">${escape(input.signature.roles_line)}</p>
            </td>
          </tr>
          ${
            input.agent_disclaimer
              ? `
          <tr>
            <td style="padding:0 48px 24px 48px;">
              <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};font-style:italic;">${escape(input.agent_disclaimer)}</p>
            </td>
          </tr>`
              : ""
          }
          <tr>
            <td style="border-top:1px solid ${RULE};padding:24px 48px;font-family:'Inter',Arial,sans-serif;font-size:12px;line-height:1.6;color:${MUTED};text-align:center;">
              <div style="color:${GAT_BLUE};font-weight:500;letter-spacing:0.04em;">${GAT_FOOTER}</div>
              <div style="margin-top:6px;">alex@alexhollienco.com</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderCta(cta: CtaSpec): string {
  if (cta.kind === "button") {
    return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="background:${GAT_RED};border-radius:2px;">
            <a href="${escapeAttr(cta.href)}" style="display:inline-block;padding:14px 28px;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${WHITE};text-decoration:none;">${escape(cta.label)}</a>
          </td>
        </tr>
      </table>`;
  }

  // cta.kind === 'reply'
  return `
    <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.65;color:${BLACK};">
      <strong style="font-weight:600;">${escape(cta.reply_prompt)}</strong>
    </p>`;
}

// Minimal HTML escape. Template inputs are trusted (rendered from Supabase
// data that Alex controls), but escaping defends against stray quotes /
// ampersands in titles and notes.
function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escape(s);
}

// Plaintext counterpart helper: strip tags from body_html (emails want both
// parts). Renderers call this themselves; shell just exposes it.
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "  - ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Shared private helper -- collapses three identical copies that lived in
// home-tour.ts, class-day.ts, and happy-hour.ts.
function firstName(full: string): string {
  return full.split(" ")[0];
}

// ===========================================================================
// Home Tour renderer
// ===========================================================================

// Serves three roster rows: Desert Ridge W1 (Stephanie), 85254 W2 (Alex solo),
// 85258 W3 (Christine). rsvp_link is OPTIONAL; null/undefined falls back to
// "Reply to this email to RSVP" plain line.

export function renderHomeTour(
  input: HomeTourInviteInput,
): InviteRenderResult {
  const signature = buildSignature(input.host_name, input.lender_flag);

  const subject = `${input.event_name} -- ${input.date}`;
  const preheader = `A curated tour of active listings on ${input.date}. ${input.time}, ${input.location}.`;
  const eyebrow = `${input.date.toUpperCase()} | HOME TOUR`;
  const headline = `Walk the route with ${firstName(input.host_name)}.`;
  const subhead = `Join a small, working tour of this month's route. Agents only, paced so you can actually see the homes and talk the market.`;

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">What to expect: three to five active listings, the broader neighborhood read, and the kind of on-the-ground intel you can use with a client by the afternoon.</p>
    ${
      input.notes
        ? `<p style="margin:0 0 14px 0;color:#444;font-size:14px;">${escape(input.notes)}</p>`
        : ""
    }
  `.trim();

  const cta: CtaSpec = input.rsvp_link
    ? {
        kind: "button",
        label: "RSVP for the Tour",
        href: input.rsvp_link,
      }
    : {
        kind: "reply",
        reply_prompt: "Reply to this email to RSVP.",
      };

  const html = renderShell({
    subject,
    preheader,
    eyebrow,
    headline,
    subhead,
    details: [
      { label: "Date", value: input.date },
      { label: "Time", value: input.time },
      { label: "Location", value: input.location },
    ],
    body_html: bodyHtml,
    cta,
    signature,
  });

  const text = buildHomeTourPlainText({
    headline,
    subhead,
    input,
    bodyHtml,
    signature,
  });

  return { subject, html, text };
}

function buildHomeTourPlainText(args: {
  headline: string;
  subhead: string;
  input: HomeTourInviteInput;
  bodyHtml: string;
  signature: SignatureBlock;
}): string {
  const { headline, subhead, input, bodyHtml, signature } = args;
  const rsvpLine = input.rsvp_link
    ? `RSVP: ${input.rsvp_link}`
    : "Reply to this email to RSVP.";

  return [
    headline,
    "",
    subhead,
    "",
    `Date: ${input.date}`,
    `Time: ${input.time}`,
    `Location: ${input.location}`,
    "",
    htmlToPlainText(bodyHtml),
    "",
    rsvpLine,
    "",
    signature.sign_off,
    signature.names_line,
    signature.roles_line,
    "",
    "Title & Escrow Services Provided by Great American Title Agency",
  ]
    .filter((l) => l !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

// ===========================================================================
// Class Day renderer
// ===========================================================================

// Serves two roster rows: Stephanie W2 (Pipeline / Conversion tracks rotate),
// Christine W4 (Social Media / AI tracks rotate -- specific track items
// pending, placeholder preserved). rsvp_link OPTIONAL.

export function renderClassDay(
  input: ClassDayInviteInput,
): InviteRenderResult {
  const signature = buildSignature(input.host_name, input.lender_flag);

  const subject = `${input.event_name} -- ${input.date}`;
  const preheader = `A working session with ${firstName(input.host_name)}. ${input.date}, ${input.time}.`;
  const eyebrow = `${input.date.toUpperCase()} | CLASS DAY`;
  const headline = input.track_focus
    ? `Class Day: ${input.track_focus}.`
    : `Class Day with ${firstName(input.host_name)}.`;
  const subhead = `Built for agents who want tools that actually move business. Small group, working format, takeaways you can use this week.`;

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Bring a notebook and one real deal or pipeline question. The session runs light on theory, heavy on what you can put into motion by Friday.</p>
    ${
      input.notes
        ? `<p style="margin:0 0 14px 0;color:#444;font-size:14px;">${escape(input.notes)}</p>`
        : ""
    }
  `.trim();

  const cta: CtaSpec = input.rsvp_link
    ? {
        kind: "button",
        label: "Save My Seat",
        href: input.rsvp_link,
      }
    : {
        kind: "reply",
        reply_prompt: "Reply to this email to reserve a seat.",
      };

  const html = renderShell({
    subject,
    preheader,
    eyebrow,
    headline,
    subhead,
    details: [
      { label: "Date", value: input.date },
      { label: "Time", value: input.time },
      { label: "Location", value: input.location },
    ],
    body_html: bodyHtml,
    cta,
    signature,
  });

  const text = buildClassDayPlainText({
    headline,
    subhead,
    input,
    bodyHtml,
    signature,
  });

  return { subject, html, text };
}

function buildClassDayPlainText(args: {
  headline: string;
  subhead: string;
  input: ClassDayInviteInput;
  bodyHtml: string;
  signature: SignatureBlock;
}): string {
  const { headline, subhead, input, bodyHtml, signature } = args;
  const rsvpLine = input.rsvp_link
    ? `RSVP: ${input.rsvp_link}`
    : "Reply to this email to reserve a seat.";

  return [
    headline,
    "",
    subhead,
    "",
    `Date: ${input.date}`,
    `Time: ${input.time}`,
    `Location: ${input.location}`,
    "",
    htmlToPlainText(bodyHtml),
    "",
    rsvpLine,
    "",
    signature.sign_off,
    signature.names_line,
    signature.roles_line,
    "",
    "Title & Escrow Services Provided by Great American Title Agency",
  ].join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

// ===========================================================================
// Content Day renderer
// ===========================================================================

// Serves Christine W1 + Stephanie W3. rsvp_link is MANDATORY -- Step 6 slot
// reservation page must be live before this renderer fires. Throws
// MissingRsvpLinkError if the caller passes null/empty.

export function renderContentDay(
  input: ContentDayInviteInput,
): InviteRenderResult {
  if (!input.rsvp_link || input.rsvp_link.trim().length === 0) {
    throw new MissingRsvpLinkError("Content Day");
  }

  const signature = buildSignature(input.host_name, input.lender_flag);

  const subject = `${input.event_name} -- reserve your 10-minute slot`;
  const preheader = `Pick a time slot on ${input.date} at ${input.location}. 10 minutes of agent-only content shot at an active listing.`;
  const eyebrow = `${input.date.toUpperCase()} | CONTENT DAY`;
  const headline = `Ten minutes of content. One active listing.`;
  const subhead = `Book a slot and we'll shoot you short-form agent content at a live home. Usable across Instagram, Facebook, and your listing decks.`;

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">How it works: pick an open time slot, arrive five minutes early, walk in, shoot two to three 30-second clips. We handle the framing and the house.</p>
    <p style="margin:0 0 14px 0;">Bring an outfit that works on camera and one talking point you want to hit. You leave with files ready to post.</p>
    ${
      input.notes
        ? `<p style="margin:0 0 14px 0;color:#444;font-size:14px;">${escape(input.notes)}</p>`
        : ""
    }
  `.trim();

  const cta: CtaSpec = {
    kind: "button",
    label: "Reserve a Time Slot",
    href: input.rsvp_link,
  };

  const html = renderShell({
    subject,
    preheader,
    eyebrow,
    headline,
    subhead,
    details: [
      { label: "Date", value: input.date },
      { label: "Time", value: input.time },
      { label: "Location", value: input.location },
    ],
    body_html: bodyHtml,
    cta,
    signature,
  });

  const text = buildContentDayPlainText({
    headline,
    subhead,
    input,
    bodyHtml,
    signature,
  });

  return { subject, html, text };
}

function buildContentDayPlainText(args: {
  headline: string;
  subhead: string;
  input: ContentDayInviteInput;
  bodyHtml: string;
  signature: SignatureBlock;
}): string {
  const { headline, subhead, input, bodyHtml, signature } = args;

  return [
    headline,
    "",
    subhead,
    "",
    `Date: ${input.date}`,
    `Time: ${input.time}`,
    `Location: ${input.location}`,
    "",
    htmlToPlainText(bodyHtml),
    "",
    `Reserve a slot: ${input.rsvp_link}`,
    "",
    signature.sign_off,
    signature.names_line,
    signature.roles_line,
    "",
    "Title & Escrow Services Provided by Great American Title Agency",
  ].join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

// ===========================================================================
// Happy Hour renderer
// ===========================================================================

// Serves Christine W2 "Connections & Cocktails" and Stephanie W4 "Happy Hour".
// rsvp_link OPTIONAL; null falls back to "Reply to this email to RSVP".

export function renderHappyHour(
  input: HappyHourInviteInput,
): InviteRenderResult {
  const signature = buildSignature(input.host_name, input.lender_flag);

  const subject = `${input.event_name} -- ${input.date}`;
  const preheader = `Join ${firstName(input.host_name)} for drinks on ${input.date}. ${input.time} at ${input.location}.`;
  const eyebrow = `${input.date.toUpperCase()} | HAPPY HOUR`;
  const headline = `Drinks, agents, and a real conversation.`;
  const subhead = `A loose gathering of the people who actually move the Valley market. Come by for one, stay for two. No agenda, real talk, good people.`;

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Bring a colleague. Bring a question you're chewing on. Leave with a few new names worth keeping in your phone.</p>
    ${
      input.notes
        ? `<p style="margin:0 0 14px 0;color:#444;font-size:14px;">${escape(input.notes)}</p>`
        : ""
    }
  `.trim();

  const cta: CtaSpec = input.rsvp_link
    ? {
        kind: "button",
        label: "Let Us Know You're Coming",
        href: input.rsvp_link,
      }
    : {
        kind: "reply",
        reply_prompt: "Reply to this email so we have a headcount.",
      };

  const html = renderShell({
    subject,
    preheader,
    eyebrow,
    headline,
    subhead,
    details: [
      { label: "Date", value: input.date },
      { label: "Time", value: input.time },
      { label: "Location", value: input.location },
    ],
    body_html: bodyHtml,
    cta,
    signature,
  });

  const text = buildHappyHourPlainText({
    headline,
    subhead,
    input,
    bodyHtml,
    signature,
  });

  return { subject, html, text };
}

function buildHappyHourPlainText(args: {
  headline: string;
  subhead: string;
  input: HappyHourInviteInput;
  bodyHtml: string;
  signature: SignatureBlock;
}): string {
  const { headline, subhead, input, bodyHtml, signature } = args;
  const rsvpLine = input.rsvp_link
    ? `RSVP: ${input.rsvp_link}`
    : "Reply to this email so we have a headcount.";

  return [
    headline,
    "",
    subhead,
    "",
    `Date: ${input.date}`,
    `Time: ${input.time}`,
    `Location: ${input.location}`,
    "",
    htmlToPlainText(bodyHtml),
    "",
    rsvpLine,
    "",
    signature.sign_off,
    signature.names_line,
    signature.roles_line,
    "",
    "Title & Escrow Services Provided by Great American Title Agency",
  ].join("\n")
    .replace(/\n{3,}/g, "\n\n");
}
