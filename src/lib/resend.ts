import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const SAFE_RECIPIENT = process.env.RESEND_SAFE_RECIPIENT;

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, from, replyTo }: SendEmailParams) {
  const originalTo = to;

  // Safety lock: route all emails to the safe recipient when set
  if (SAFE_RECIPIENT) {
    const originalLabel = Array.isArray(originalTo) ? originalTo.join(", ") : originalTo;
    to = SAFE_RECIPIENT;
    subject = `[TEST -> ${originalLabel}] ${subject}`;
  }

  const { data, error } = await resend.emails.send({
    from: from ?? "Alex Hollien <alex@alexhollienco.com>",
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    replyTo,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
}
