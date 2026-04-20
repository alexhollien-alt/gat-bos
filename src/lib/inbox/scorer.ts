// src/lib/inbox/scorer.ts
import Anthropic from "@anthropic-ai/sdk";
import type { ThreadScore } from "./types";

const anthropic = new Anthropic();

// System prompt is prompt-cached (ephemeral) -- one cache write per cold start,
// then cache hits for every subsequent thread scored in the same scan run.
const SYSTEM_PROMPT = `You are an email triage assistant for Alex Hollien, a title sales executive. Your only job is to decide whether an email thread needs a reply from Alex.

Score the thread against these four rules. Rules can stack -- add points for each rule that fires:

- "direct_question" (+40): Alex is directly asked a question ("?", "can you", "do you", "would you", "what do you think", "let me know if", "please advise")
- "deliverable_request" (+35): A request for a deliverable, scheduling, or decision ("can you send", "need a flyer", "need you to decide", "schedule a time", "can we meet", "when works for you", "need your approval")
- "escalation_language" (+30 base, +10 if Tier A contact, +5 if Tier B contact): Urgent or time-sensitive language from a known contact ("urgent", "ASAP", "time sensitive", "need this today", "closing tomorrow", "deal falling through", "end of day")
- "cold_contact" (+25): Sender is not a known contact and this appears to be a genuine first outreach (not spam, not a newsletter, not an automated notification)

Threshold: score >= 35 means needs_reply = true.

DO NOT surface: newsletters, marketing emails, automated notifications, order/shipping confirmations, receipts, LinkedIn/Zillow/Realtor.com alerts, calendar invite acceptances without a message body.

Respond ONLY with a JSON object. No explanation. No markdown. Just the object:
{"score": <integer 0-100>, "matched_rules": [<names of rules that fired>], "needs_reply": <true|false>}`;

export async function scoreThread(params: {
  subject: string;
  senderEmail: string;
  senderName: string;
  snippet: string;
  isKnownContact: boolean;
  contactTier?: string | null;
}): Promise<ThreadScore> {
  const { subject, senderEmail, senderName, snippet, isKnownContact, contactTier } = params;

  const userContent = [
    `From: ${senderName} <${senderEmail}>`,
    `Subject: ${subject}`,
    `Known contact: ${isKnownContact ? `Yes, Tier ${contactTier ?? "unknown"}` : "No"}`,
    `Snippet: ${snippet.slice(0, 400)}`,
  ].join("\n");

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "{}";

    const parsed = JSON.parse(text);
    return {
      score: typeof parsed.score === "number"
        ? Math.min(100, Math.max(0, Math.round(parsed.score)))
        : 0,
      matched_rules: Array.isArray(parsed.matched_rules) ? parsed.matched_rules : [],
      needs_reply: typeof parsed.needs_reply === "boolean" ? parsed.needs_reply : false,
    };
  } catch (err) {
    // Scoring failure = skip this pass, not a crash. Thread re-evaluates next scan.
    // Log so recurring failures (API outage, schema drift, quota) are diagnosable.
    console.error("scoreThread failed", err instanceof Error ? err.message : err);
    return { score: 0, matched_rules: [], needs_reply: false };
  }
}
