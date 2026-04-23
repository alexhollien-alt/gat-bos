// Class Day invite renderer.
// Serves two roster rows: Stephanie W2 (Pipeline / Conversion tracks rotate),
// Christine W4 (Social Media / AI tracks rotate -- specific track items
// pending, placeholder preserved). rsvp_link OPTIONAL.

import { buildSignature } from "./signature";
import {
  escape,
  htmlToPlainText,
  renderShell,
  type CtaSpec,
} from "./shell";
import type { ClassDayInviteInput, InviteRenderResult } from "./types";

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
  input: ClassDayInviteInput;
  bodyHtml: string;
  signature: ReturnType<typeof buildSignature>;
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
