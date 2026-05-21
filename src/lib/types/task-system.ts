// Task System Phase 0 type contracts.
//
// Tables shipped in supabase/migrations/20260520194801_task_system_phase0.sql:
//   nodes        -- typed-by-enum entity
//   tags         -- flat namespace
//   node_tags    -- M:N join
//   cadences     -- relationship cadence engine
//   node_events  -- projection of activity_events (read-optimized)
//
// Verb whitelist that drives node_events projection lives at
// src/lib/task-system/projected-verbs.ts.

export type NodeType =
  | "task"
  | "project"
  | "area"
  | "contact"
  | "interaction"
  | "event";

export type TaskStatus = "inbox" | "next" | "waiting" | "someday" | "done" | "dropped";
export type ProjectStatus = "active" | "paused" | "shipped" | "killed";
export type AreaStatus = "live" | "dormant";
export type ContactStatus = "tier1" | "tier2" | "tier3" | "prospect" | "inactive";

export type ContactTier = 1 | 2 | 3;

export interface Node {
  id: string;
  type: NodeType;
  title: string;
  body: string | null;
  status: string | null;
  user_id: string;
  parent_id: string | null;
  metadata: Record<string, unknown>;
  last_touched_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface NodeTag {
  node_id: string;
  tag_id: string;
}

export interface Cadence {
  contact_id: string;
  tier: ContactTier;
  target_days: number;
  last_touched_at: string | null;
  next_due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NodeEvent {
  id: string;
  activity_id: string;
  user_id: string;
  contact_id: string | null;
  project_id: string | null;
  node_id: string | null;
  type: string;
  occurred_at: string;
  summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// /api/captures payload + response shapes when target = 'task_system'.

export type CaptureSource = "claude" | "todoist" | "email" | "sms" | "manual";

export interface CaptureHints {
  type?: NodeType;
  contact?: string;
  project?: string;
  area?: string;
  tier?: ContactTier;
}

export type CaptureTarget = "captures" | "task_system";

export interface CaptureRequestBody {
  raw_text: string;
  target?: CaptureTarget;
  source?: CaptureSource;
  hints?: CaptureHints;
}

export interface CaptureInferred {
  type: NodeType;
  parent_id: string | null;
  tier: ContactTier | null;
  summary: string | null;
  fallback: boolean;
}

export interface CaptureWarning {
  code:
    | "unresolved_contact"
    | "unresolved_project"
    | "unresolved_area"
    | "inference_fallback"
    | "missing_tier";
  message: string;
  hint?: string;
}

export interface TaskSystemCaptureResponse {
  id: string;
  type: NodeType;
  inferred: CaptureInferred;
  warnings: CaptureWarning[];
}

// Tier -> default target_days. Same numbers as handoff doc Section 3.6.
export const TIER_TARGET_DAYS: Record<ContactTier, number> = {
  1: 7,
  2: 14,
  3: 30,
};
