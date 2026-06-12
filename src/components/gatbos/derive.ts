// GAT-BOS redesign: derive-first mapping layer.
// No schema migrations -- every prototype concept the schema can't feed is
// computed here from live columns (decision locked 2026-06-11).

import type { WarmthKey } from "./ui";

// 10-step relationship journey (prototype people.jsx). The live `contacts.stage`
// enum has 5 values; mapped onto the rail visually.
export const JOURNEY = [
  "First Interaction",
  "Follow-up Call",
  "Book First Meeting",
  "Plan First Marketing Opportunity",
  "Active Support",
  "Deal Sent / Escrow Opportunity",
  "Long-term Nurture",
  "Event Invite / Awareness",
  "Repeat Partner",
  "VIP Advocate",
] as const;

export const OFF_TRACK: Record<string, boolean> = {
  "At-risk / Reactivation": true,
  "Dormant -- Keep in Nurture": true,
};

// live stage enum -> journey stage label
const STAGE_TO_JOURNEY: Record<string, string> = {
  new: "First Interaction",
  warm: "Plan First Marketing Opportunity",
  active_partner: "Active Support",
  advocate: "VIP Advocate",
  dormant: "Dormant -- Keep in Nurture",
};

export function journeyStage(stage: string, warmth: WarmthKey): string {
  if (warmth === "atrisk") return "At-risk / Reactivation";
  return STAGE_TO_JOURNEY[stage] ?? "First Interaction";
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

// Warmth bucket, computed from health_score (0-100), rep_pulse (1-10),
// days since latest interaction, and the live stage enum. Green-only system.
export function deriveWarmth({
  stage,
  healthScore,
  repPulse,
  days,
  tier,
}: {
  stage: string;
  healthScore: number | null;
  repPulse: number | null;
  days: number | null;
  tier: string | null;
}): WarmthKey {
  if (stage === "dormant") return "dormant";
  const score = healthScore ?? (repPulse != null ? repPulse * 10 : null);
  const d = days ?? Number.POSITIVE_INFINITY;
  if (d <= 7 && (score ?? 60) >= 70) return "hot";
  if (d <= 14) return "warm";
  if (d <= 30) return "needs";
  if (d <= 60) return "cooling";
  // gone quiet: high-tier or formerly-healthy contacts are AT RISK, not dormant
  if (tier === "A" || (score ?? 0) >= 50) return "atrisk";
  return "dormant";
}

// tier -> prototype "value" chip
export function tierValue(tier: string | null): "high" | "medium" | "low" {
  if (tier === "A") return "high";
  if (tier === "B") return "medium";
  return "low";
}

export function relativeLabel(days: number | null): string {
  if (days == null) return "No touch on file";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 28) return `${Math.round(days / 7)} week${days >= 14 ? "s" : ""} ago`;
  return `${Math.round(days / 30)} month${days >= 60 ? "s" : ""} ago`;
}

export function dueLabel(iso: string | null): string {
  if (!iso) return "--";
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return "--";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// live task priority (low|medium|high) -> prototype 1-4 ladder
export function priorityRank(priority: string | null): number {
  if (priority === "high") return 1;
  if (priority === "medium") return 2;
  if (priority === "low") return 3;
  return 4;
}

export function fullName(c: { full_name: string | null; first_name: string; last_name: string }): string {
  return c.full_name ?? `${c.first_name} ${c.last_name}`.trim();
}

export function todayHeading(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).replace(",", " ·");
}
