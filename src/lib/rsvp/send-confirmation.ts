// Sends the RSVP confirmation email with .ics calendar attachment via Resend.
// Honors RESEND_SAFE_RECIPIENT to redirect during test/staging.
//
// Failure mode: this is fire-and-forget from the API route's perspective. If
// Resend errors, log and return null -- the RSVP row is already persisted and
// the user has seen success. Do not block the form on a flaky mail provider.

import { Resend } from "resend";
import { logError } from "@/lib/error-log";
import {
  buildConfirmationHtml,
  buildConfirmationSubject,
  buildConfirmationText,
  buildIcs,
  type ConfirmationInput,
} from "./confirmation-email";

const ROUTE = "lib/rsvp/send-confirmation";

interface SendArgs extends ConfirmationInput {
  fromOverride?: string;
}

export async function sendRsvpConfirmation(
  args: SendArgs,
): Promise<{ messageId: string | null; error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await logError(ROUTE, "RESEND_API_KEY not set, skipping confirmation send", {
      email: args.email,
      event: args.eventTitle,
    });
    return { messageId: null, error: "RESEND_API_KEY_MISSING" };
  }

  const safeRecipient = process.env.RESEND_SAFE_RECIPIENT?.trim() || null;
  const originalTo = args.email;
  const finalTo = safeRecipient ?? originalTo;
  const baseSubject = buildConfirmationSubject(args);
  const finalSubject = safeRecipient
    ? `[TEST -> ${originalTo}] ${baseSubject}`
    : baseSubject;

  // Sender is bound to alexhollienco.com (verified Resend domain). The agent's
  // own brokerage address (e.g. exec-elite.com) goes in replyTo so brokers
  // reach the host directly. Display name is the host so the inbox preview
  // reads "Denise Van Den Bossche" rather than the platform alias.
  const from =
    args.fromOverride ??
    `${args.hostName} <${process.env.RSVP_FROM_EMAIL ?? "rsvp@alexhollienco.com"}>`;

  const ics = buildIcs(args);
  const html = buildConfirmationHtml(args);
  const text = buildConfirmationText(args);

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: [finalTo],
      replyTo: args.hostEmail,
      subject: finalSubject,
      html,
      text,
      attachments: [
        {
          filename: "invite.ics",
          content: Buffer.from(ics, "utf-8").toString("base64"),
        },
      ],
    });
    if (error) {
      await logError(ROUTE, `resend api error: ${error.message}`, {
        email: args.email,
        finalTo,
        event: args.eventTitle,
      });
      return { messageId: null, error: error.message };
    }
    return { messageId: data?.id ?? null, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logError(ROUTE, `confirmation send threw: ${message}`, {
      email: args.email,
      finalTo,
      event: args.eventTitle,
    });
    return { messageId: null, error: message };
  }
}
