// Phase 1.3.2-A: escalation notification seam.
// Default behavior is no-op so that 1.3.2 ships without committing a delivery
// channel (SMS, Slack, email-to-Marlene). The integration point stays visible
// for future phases. Set ESCALATION_NOTIFY=true and wire a transport in
// `dispatch()` once the channel decision lands (deferred per phase-1.3.2 plan
// "Out of scope" -> Marlene notification delivery).

export interface EscalationNotice {
  draft_id: string;
  escalation_flag: "marlene" | "agent_followup";
  escalation_reason: string | null;
  from_email: string;
  subject: string;
}

function notifyEnabled(): boolean {
  return process.env.ESCALATION_NOTIFY === "true";
}

export async function notifyEscalation(notice: EscalationNotice): Promise<void> {
  if (!notifyEnabled()) return;
  await dispatch(notice);
}

// Stub. Real transport lands in a later phase. Kept async so the future wiring
// (HTTP webhook, Resend send, Slack chat.postMessage) drops in without
// changing every caller's await contract.
async function dispatch(notice: EscalationNotice): Promise<void> {
  // No-op while ESCALATION_NOTIFY remains gated. Reference the payload so the
  // signature stays load-bearing for the future transport without tripping
  // @typescript-eslint/no-unused-vars on the scaffold.
  void notice;
  return;
}
