// Slice 4 Task 4 -- Resend adapter.
// The only file inside src/lib/messaging/ that reads RESEND_API_KEY.
// Honors RESEND_SAFE_RECIPIENT for non-prod safety: when set, every
// recipient is rewritten to that address and the subject is prefixed
// with the original recipient so the test mailbox stays auditable.
//
// Note: src/lib/resend/client.ts (sendDraft) is the legacy direct caller
// from /api/email/approve-and-send. Migration of that route to call
// sendMessage() is logged to LATER.md as a Slice 5A or 5B follow-up.
import { Resend } from "resend";
import { withRetry } from "@/lib/retry";
import type { AdapterSendInput, AdapterSendResult } from "../types";

const DEFAULT_FROM = "Alex Hollien <alex@alexhollienco.com>";

export async function sendViaResend(input: AdapterSendInput): Promise<AdapterSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const resend = new Resend(apiKey);
  const safeRecipient = process.env.RESEND_SAFE_RECIPIENT?.trim() || null;

  const finalTo = safeRecipient ?? input.to;
  const finalSubject = safeRecipient
    ? `[TEST -> ${input.to}] ${input.subject}`
    : input.subject;

  const result = await withRetry(async () => {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [finalTo],
      subject: finalSubject,
      html: input.html,
      text: input.text,
    });
    if (error) throw new Error(`Resend error: ${error.message}`);
    if (!data?.id) throw new Error("Resend returned no message id");
    return data;
  }, "messaging.resend.send");

  return { messageId: result.id };
}
