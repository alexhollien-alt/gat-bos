// Home Tour invite renderer.
// Serves three roster rows: Desert Ridge W1 (Stephanie), 85254 W2 (Alex solo),
// 85258 W3 (Christine). rsvp_link is OPTIONAL; null/undefined falls back to
// "Reply to this email to RSVP" plain line.

import { buildSignature } from "./signature";
import {
  escape,
  htmlToPlainText,
  renderShell,
  type CtaSpec,
} from "./shell";
import type { HomeTourInviteInput, InviteRenderResult } from "./types";

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

  const text = buildPlainText({
    headline,
    subhead,
    input,
    bodyHtml,
    signature,
  });

  return { subject, html, text };
}

function firstName(full: string): string {
  return full.split(" ")[0];
}

function buildPlainText(args: {
  headline: string;
  subhead: string;
  input: HomeTourInviteInput;
  bodyHtml: string;
  signature: ReturnType<typeof buildSignature>;
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
