// Content Day invite renderer.
// Serves Christine W1 + Stephanie W3. rsvp_link is MANDATORY -- Step 6 slot
// reservation page must be live before this renderer fires. Throws
// MissingRsvpLinkError if the caller passes null/empty.

import { buildSignature } from "./signature";
import {
  escape,
  htmlToPlainText,
  renderShell,
  type CtaSpec,
} from "./shell";
import {
  MissingRsvpLinkError,
  type ContentDayInviteInput,
  type InviteRenderResult,
} from "./types";

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

  const text = buildPlainText({
    headline,
    subhead,
    input,
    bodyHtml,
    signature,
  });

  return { subject, html, text };
}

function buildPlainText(args: {
  headline: string;
  subhead: string;
  input: ContentDayInviteInput;
  bodyHtml: string;
  signature: ReturnType<typeof buildSignature>;
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
