// src/lib/open-house/resend-blast.ts
// Dedicated Resend sender for open house blasts. Unlike the shared messaging
// adapter, this controls From (agent-branded, subdomain), replyTo, and the
// List-Unsubscribe / List-Unsubscribe-Post headers (RFC 8058 one-click) that
// are central to landing in Primary. Honors RESEND_SAFE_RECIPIENT for testing.

import { Resend } from "resend";
import { withRetry } from "@/lib/retry";
import { FORBIDDEN_FROM_DOMAINS } from "./config";

export interface BlastEmailInput {
  to: string;
  fromName: string; // agent display name (agent branding)
  fromAddress: string; // opens@opens.alexhollienco.com
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string; // per-recipient one-click https endpoint
  unsubscribeMailto?: string; // optional mailto fallback
}

// WALL: never send from the root or CRM domain. The dedicated subdomain
// (opens.alexhollienco.com) IS allowed. Forbid the root/CRM hosts EXACTLY,
// never their subdomains.
export function assertFromAllowed(fromAddress: string): void {
  const domain = (fromAddress.split("@")[1] ?? "").trim().toLowerCase();
  if (!domain) throw new Error(`Invalid From address: ${fromAddress}`);
  if (FORBIDDEN_FROM_DOMAINS.includes(domain)) {
    throw new Error(
      `WALL violation: blast may not send from ${domain}. Use the dedicated subdomain.`,
    );
  }
}

export interface BlastSendResult {
  messageId: string;
}

export async function sendBlastEmail(input: BlastEmailInput): Promise<BlastSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  assertFromAllowed(input.fromAddress);

  const resend = new Resend(apiKey);
  const safeRecipient = process.env.RESEND_SAFE_RECIPIENT?.trim() || null;
  const finalTo = safeRecipient ?? input.to;
  const finalSubject = safeRecipient ? `[TEST -> ${input.to}] ${input.subject}` : input.subject;

  const listUnsub =
    `<${input.unsubscribeUrl}>` +
    (input.unsubscribeMailto ? `, <${input.unsubscribeMailto}>` : "");

  const from = `${input.fromName} <${input.fromAddress}>`;

  const result = await withRetry(async () => {
    const { data, error } = await resend.emails.send({
      from,
      to: [finalTo],
      replyTo: input.replyTo,
      subject: finalSubject,
      html: input.html,
      text: input.text,
      headers: {
        "List-Unsubscribe": listUnsub,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (error) throw new Error(`Resend error: ${error.message}`);
    if (!data?.id) throw new Error("Resend returned no message id");
    return data;
  }, "open-house.blast.send");

  return { messageId: result.id };
}
