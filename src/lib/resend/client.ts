// Phase 1.3.1 Phase 5 -- Resend send wrapper for draft approval flow.
// Honors RESEND_SAFE_RECIPIENT to redirect all mail during test/staging.
import { Resend } from "resend";
import { withRetry } from "@/lib/retry";

const DEFAULT_FROM = "Alex Hollien <alex@alexhollienco.com>";

export interface SendDraftInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
}

export interface SendDraftResult {
  messageId: string;
  redirectedTo: string | null;
  originalTo: string;
}

export async function sendDraft(input: SendDraftInput): Promise<SendDraftResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const resend = new Resend(apiKey);
  const safeRecipient = process.env.RESEND_SAFE_RECIPIENT?.trim() || null;

  const originalTo = input.to;
  const finalTo = safeRecipient ?? originalTo;
  const finalSubject = safeRecipient
    ? `[TEST -> ${originalTo}] ${input.subject}`
    : input.subject;

  const headers: Record<string, string> = {};
  if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
  if (input.references) headers["References"] = input.references;

  const result = await withRetry(async () => {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [finalTo],
      subject: finalSubject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
    if (error) throw new Error(`Resend error: ${error.message}`);
    if (!data?.id) throw new Error("Resend returned no message id");
    return data;
  }, "resend.emails.send");

  return {
    messageId: result.id,
    redirectedTo: safeRecipient,
    originalTo,
  };
}
