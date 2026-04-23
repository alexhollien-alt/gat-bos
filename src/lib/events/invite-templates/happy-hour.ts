// Happy Hour invite renderer.
// Serves Christine W2 "Connections & Cocktails" and Stephanie W4 "Happy Hour".
// rsvp_link OPTIONAL; null falls back to "Reply to this email to RSVP".

import { buildSignature } from "./signature";
import {
  escape,
  htmlToPlainText,
  renderShell,
  type CtaSpec,
} from "./shell";
import type { HappyHourInviteInput, InviteRenderResult } from "./types";

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
  input: HappyHourInviteInput;
  bodyHtml: string;
  signature: ReturnType<typeof buildSignature>;
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
