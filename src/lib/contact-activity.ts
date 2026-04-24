import {
  Interaction,
  Task,
  FollowUp,
  MaterialRequest,
  DesignAsset,
  InteractionType,
} from "./types";

/**
 * Unified activity feed for the contact detail page.
 * Merges 5 source tables into one chronologically-sorted list.
 *
 * Inclusion rules:
 *  - interactions: all rows
 *  - tasks: only when status === "completed"
 *  - follow_ups: only when status === "completed". Slice 2C consolidated
 *    follow_ups into tasks WHERE type='follow_up'; callers may pass either
 *    legacy FollowUp rows or Task rows (the union below covers both).
 *  - material_requests: every row, anchored on created_at (Alex's commitment moment)
 *  - design_assets: every row, anchored on created_at
 *
 * Excluded:
 *  - notes (live in the Notes tab, not events)
 *  - open tasks / open follow-ups (live in tab badges, not the feed)
 *  - field edits, tag changes, internal_note edits
 */

// Slice 2C: callers pass Task rows (with type='follow_up') instead of legacy
// FollowUp rows. We only need a small subset of fields to build the feed entry.
type FollowUpFeedRow = {
  id: string;
  status: string;
  reason?: string | null;
  due_reason?: string | null;
  title?: string | null;
  completed_at?: string | null;
  created_at: string;
};

export type ActivitySource =
  | "interaction"
  | "task_done"
  | "followup_done"
  | "material_request"
  | "design_asset";

export interface ActivityEvent {
  id: string;
  source: ActivitySource;
  /** Display label, e.g. "Call", "Task done", "Print request", "Design saved" */
  sourceLabel: string;
  /** Lucide icon name as a string */
  iconName: string;
  /** Tailwind class for the left source bar color */
  barColorClass: string;
  /** Plain text summary, truncated by the consumer if needed */
  summary: string;
  /** ISO timestamp used for ordering */
  timestamp: string;
  /** Optional badge text (e.g. material status) */
  badge?: string;
  /** Original source row id for click-through */
  sourceId: string;
}

const INTERACTION_LABELS: Record<InteractionType, string> = {
  call: "Call",
  text: "Text",
  email: "Email",
  meeting: "Meeting",
  broker_open: "Broker Open",
  lunch: "Lunch",
  note: "Note",
};

const INTERACTION_ICONS: Record<InteractionType, string> = {
  call: "Phone",
  text: "MessageSquare",
  email: "Mail",
  meeting: "Users",
  broker_open: "Building",
  lunch: "UtensilsCrossed",
  note: "FileText",
};

export function buildActivityFeed({
  interactions,
  tasks,
  followUps,
  materialRequests,
  designAssets,
}: {
  interactions: Interaction[];
  tasks: Task[];
  followUps: FollowUpFeedRow[] | FollowUp[];
  materialRequests: MaterialRequest[];
  designAssets: DesignAsset[];
}): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  // Interactions: all
  for (const i of interactions) {
    events.push({
      id: `interaction-${i.id}`,
      source: "interaction",
      sourceLabel: INTERACTION_LABELS[i.type] ?? i.type,
      iconName: INTERACTION_ICONS[i.type] ?? "Circle",
      barColorClass: "bg-primary",
      summary: i.summary,
      timestamp: i.occurred_at,
      sourceId: i.id,
    });
  }

  // Tasks: only completed
  for (const t of tasks) {
    if (t.status !== "completed") continue;
    events.push({
      id: `task-${t.id}`,
      source: "task_done",
      sourceLabel: "Task done",
      iconName: "CheckCircle2",
      barColorClass: "bg-chart-3",
      summary: t.title,
      timestamp: t.completed_at ?? t.created_at,
      sourceId: t.id,
    });
  }

  // Follow-ups: only completed.
  // Slice 2C: prefer the migrated due_reason column, then fall back to the
  // legacy FollowUp.reason or the Task.title that was set on insert.
  for (const f of followUps) {
    if (f.status !== "completed") continue;
    const fr = f as FollowUpFeedRow;
    const summary =
      (fr.due_reason ?? null) ?? (fr.reason ?? null) ?? (fr.title ?? "");
    events.push({
      id: `followup-${f.id}`,
      source: "followup_done",
      sourceLabel: "Follow-up resolved",
      iconName: "Clock",
      barColorClass: "bg-chart-3",
      summary,
      timestamp: f.completed_at ?? f.created_at,
      sourceId: f.id,
    });
  }

  // Material requests: anchored on created_at (commitment moment)
  for (const m of materialRequests) {
    events.push({
      id: `material-${m.id}`,
      source: "material_request",
      sourceLabel: "Print request",
      iconName: "Printer",
      barColorClass: "bg-chart-2",
      summary: m.title,
      timestamp: m.created_at,
      badge: m.status,
      sourceId: m.id,
    });
  }

  // Design assets
  for (const d of designAssets) {
    events.push({
      id: `design-${d.id}`,
      source: "design_asset",
      sourceLabel: "Design saved",
      iconName: "FileImage",
      barColorClass: "bg-chart-4",
      summary: d.name,
      timestamp: d.created_at,
      badge: d.asset_type,
      sourceId: d.id,
    });
  }

  // Sort newest first
  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return events;
}

/**
 * Filter an activity feed to events within a time window.
 * `days = null` means "all time".
 */
export function filterByDays(
  events: ActivityEvent[],
  days: number | null
): ActivityEvent[] {
  if (days === null) return events;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return events.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
}

/**
 * Format an ISO timestamp as a relative-or-absolute string per Draft 2 rules.
 *
 * < 1 hour: "just now" or "Nm ago"
 * 1-23 hours: "Nh ago"
 * 1-6 days: "Nd ago"
 * 7-30 days: "Mar 28"
 * > 30 days, same year: "Feb 14"
 * Prior years: "Feb 14, 2025"
 */
export function formatActivityTime(timestamp: string): string {
  const then = new Date(timestamp);
  const now = new Date();
  const ageMs = now.getTime() - then.getTime();
  const minutes = Math.floor(ageMs / (1000 * 60));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const sameYear = then.getFullYear() === now.getFullYear();
  const month = then.toLocaleDateString("en-US", { month: "short" });
  const day = then.getDate();
  if (sameYear) return `${month} ${day}`;
  return `${month} ${day}, ${then.getFullYear()}`;
}
