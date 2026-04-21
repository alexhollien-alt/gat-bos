// Phase 1.3.2-C -- Observation readout helpers.
// Typed query helpers over the email_drafts_observation view. No UI surface
// in 1.3.2 per plan; Phase E runs these against the observation window and
// writes ~/.claude/plans/phase-1.3.2-readout.md.
//
// Window filtering: every helper accepts an optional { from, to } range
// (ISO timestamps). When omitted the helper runs over the full view.
//
// Client: service-role adminClient so the helpers run cleanly from scripts
// or server contexts that aren't carrying a user session. The view itself
// is security_invoker=true, which means anon/authenticated calls still honor
// email_drafts + emails RLS; service_role bypasses RLS by design.
import { adminClient } from "@/lib/supabase/admin";
import type { ContactTier } from "@/lib/types";

export type ObservationAction =
  | "send_now"
  | "create_gmail_draft"
  | "discarded";

export type EscalationFlag = "marlene" | "agent_followup";

export interface ObservationRow {
  draft_id: string;
  contact_id: string | null;
  contact_tier: ContactTier | null;
  escalation_flag: EscalationFlag | null;
  action_taken: ObservationAction | null;
  generated_at: string;
  acted_at: string | null;
  time_to_action_seconds: number | null;
  was_revised: boolean;
}

export interface ObservationWindow {
  from?: string;
  to?: string;
}

export interface ActionCounts {
  send_now: number;
  create_gmail_draft: number;
  discarded: number;
  pending: number;
  total: number;
}

export interface TierCounts {
  A: number;
  B: number;
  C: number;
  P: number;
  none: number;
  total: number;
}

export interface TimeToActionStats {
  count: number;
  avg_seconds: number | null;
  median_seconds: number | null;
  p75_seconds: number | null;
  p95_seconds: number | null;
}

export interface EscalationRateResult {
  total: number;
  flagged: number;
  marlene: number;
  agent_followup: number;
  rate: number;
}

export interface FalsePositiveRateResult {
  flag: EscalationFlag | "all";
  flagged_terminal: number;
  discarded: number;
  rate: number;
}

const VIEW = "email_drafts_observation";

async function loadWindow(
  win: ObservationWindow = {},
): Promise<ObservationRow[]> {
  let query = adminClient.from(VIEW).select("*");
  if (win.from) query = query.gte("generated_at", win.from);
  if (win.to) query = query.lte("generated_at", win.to);
  const { data, error } = await query;
  if (error) {
    throw new Error(`observation readout: ${error.message}`);
  }
  return (data ?? []) as ObservationRow[];
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

export async function countByAction(
  win: ObservationWindow = {},
): Promise<ActionCounts> {
  const rows = await loadWindow(win);
  const out: ActionCounts = {
    send_now: 0,
    create_gmail_draft: 0,
    discarded: 0,
    pending: 0,
    total: rows.length,
  };
  for (const r of rows) {
    if (r.action_taken === "send_now") out.send_now++;
    else if (r.action_taken === "create_gmail_draft") out.create_gmail_draft++;
    else if (r.action_taken === "discarded") out.discarded++;
    else out.pending++;
  }
  return out;
}

export async function countByTier(
  win: ObservationWindow = {},
): Promise<TierCounts> {
  const rows = await loadWindow(win);
  const out: TierCounts = { A: 0, B: 0, C: 0, P: 0, none: 0, total: rows.length };
  for (const r of rows) {
    if (r.contact_tier === "A") out.A++;
    else if (r.contact_tier === "B") out.B++;
    else if (r.contact_tier === "C") out.C++;
    else if (r.contact_tier === "P") out.P++;
    else out.none++;
  }
  return out;
}

export async function avgTimeToAction(
  win: ObservationWindow = {},
): Promise<TimeToActionStats> {
  const rows = await loadWindow(win);
  const actioned = rows
    .map((r) => r.time_to_action_seconds)
    .filter((n): n is number => typeof n === "number" && n >= 0)
    .sort((a, b) => a - b);
  if (actioned.length === 0) {
    return {
      count: 0,
      avg_seconds: null,
      median_seconds: null,
      p75_seconds: null,
      p95_seconds: null,
    };
  }
  const sum = actioned.reduce((s, n) => s + n, 0);
  return {
    count: actioned.length,
    avg_seconds: sum / actioned.length,
    median_seconds: percentile(actioned, 50),
    p75_seconds: percentile(actioned, 75),
    p95_seconds: percentile(actioned, 95),
  };
}

export async function escalationRate(
  win: ObservationWindow = {},
): Promise<EscalationRateResult> {
  const rows = await loadWindow(win);
  let marlene = 0;
  let agent_followup = 0;
  for (const r of rows) {
    if (r.escalation_flag === "marlene") marlene++;
    else if (r.escalation_flag === "agent_followup") agent_followup++;
  }
  const flagged = marlene + agent_followup;
  return {
    total: rows.length,
    flagged,
    marlene,
    agent_followup,
    rate: rows.length === 0 ? 0 : flagged / rows.length,
  };
}

// False-positive proxy (Phase E caveat required): a flagged draft that
// reached a terminal state via discard. Alex's own judgment on each flag
// is inferred from the discard action because escalation_cleared fires
// only on that branch (see src/app/api/email/approve-and-send/route.ts
// escalationLifecycleEvent). Phase E readout should label this as a
// lower-bound proxy, not a verified ground-truth rate.
export async function falsePositiveRate(
  options: { flag?: EscalationFlag; window?: ObservationWindow } = {},
): Promise<FalsePositiveRateResult> {
  const { flag, window: win } = options;
  const rows = await loadWindow(win);
  const scoped = rows.filter((r) => {
    if (!r.escalation_flag) return false;
    if (r.action_taken === null) return false;
    if (flag && r.escalation_flag !== flag) return false;
    return true;
  });
  const discarded = scoped.filter((r) => r.action_taken === "discarded").length;
  return {
    flag: flag ?? "all",
    flagged_terminal: scoped.length,
    discarded,
    rate: scoped.length === 0 ? 0 : discarded / scoped.length,
  };
}
