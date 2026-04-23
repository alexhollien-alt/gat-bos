// Shared HTML shell for all GAT Event Cycle invite emails.
// Kit 1 (Instrument Serif + Inter) via Google Fonts CSS. No Typekit (silently
// fails in mail clients). GAT Red CTA, GAT Blue accent once, black on white.
// Voice per ~/.claude/rules/brand.md: Sotheby's prestige + Flodesk warmth +
// Apple precision. No banned words, no exclamation marks.

import type { SignatureBlock } from "./signature";

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600&display=swap";

const GAT_RED = "#b31a35";
const GAT_BLUE = "#003087";
const BLACK = "#0a0a0a";
const WHITE = "#ffffff";
const OFFWHITE = "#f7f7f5";
const RULE = "#e8e8e8";
const MUTED = "#666666";

export interface ShellInput {
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

export type CtaSpec =
  | { kind: "button"; label: string; href: string }
  | { kind: "reply"; reply_prompt: string }; // renders plain "Reply to RSVP" line

const GAT_FOOTER =
  "Title &amp; Escrow Services Provided by Great American Title Agency";

export function renderShell(input: ShellInput): string {
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
export function escape(s: string): string {
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
export function htmlToPlainText(html: string): string {
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
