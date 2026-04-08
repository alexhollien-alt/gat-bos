// src/lib/spine/types.ts
// Shared Zod schemas and TypeScript types for the Spine layer.
// These are the contract between API routes, parser, and UI.

import { z } from "zod";

// ==========================
// Enums
// ==========================
export const CommitmentKind = z.enum([
  "flyer","email","intro","data","call","meeting","gift","other",
]);
export const CommitmentStatus = z.enum([
  "open","in_progress","delivered","dropped","blocked",
]);
export const CaptureSource = z.enum([
  "meeting","claude_conversation","eod","voice","micro_capture","manual","dashboard_bar",
]);
export const InboxSource = z.enum([
  "claude_session","voice","micro","eod","morning","manual","dashboard_bar",
]);
export const FocusReason = z.enum(["signal","cadence","manual","commitment"]);
export const FocusStatus = z.enum(["pending","touched","skipped","deferred"]);
export const FocusOutcome = z.enum(["warm","cold","delivered","no_answer","left_message"]);
export const SignalKind = z.enum([
  "stale","closing_soon","birthday","listing_dom","market_shift","custom",
]);
export const SignalSeverity = z.enum(["low","normal","high","urgent"]);
export const SignalStatus = z.enum(["active","acted_on","dismissed","expired"]);
export const CycleStatus = z.enum(["active","paused","dormant","lost"]);

// ==========================
// Row types
// ==========================
export const CommitmentRow = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  contact_id: z.string().uuid().nullable(),
  opportunity_id: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  kind: CommitmentKind.nullable(),
  promised_at: z.string(),
  due_at: z.string().nullable(),
  status: CommitmentStatus,
  source: CaptureSource.nullable(),
  source_ref: z.string().nullable(),
  delivered_at: z.string().nullable(),
  delivered_via: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});
export type Commitment = z.infer<typeof CommitmentRow>;

export const FocusQueueRow = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  week_of: z.string(),
  rank: z.number().nullable(),
  reason: FocusReason.nullable(),
  reason_detail: z.string().nullable(),
  suggested_action: z.string().nullable(),
  status: FocusStatus,
  touched_at: z.string().nullable(),
  touched_via: z.string().nullable(),
  outcome: FocusOutcome.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});
export type FocusQueue = z.infer<typeof FocusQueueRow>;

export const SignalRow = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  contact_id: z.string().uuid().nullable(),
  opportunity_id: z.string().uuid().nullable(),
  kind: SignalKind,
  severity: SignalSeverity,
  detected_at: z.string(),
  window_start: z.string().nullable(),
  window_end: z.string().nullable(),
  title: z.string(),
  detail: z.string().nullable(),
  suggested_action: z.string().nullable(),
  status: SignalStatus,
  acted_on_at: z.string().nullable(),
  created_at: z.string(),
  deleted_at: z.string().nullable(),
});
export type Signal = z.infer<typeof SignalRow>;

export const CycleStateRow = z.object({
  contact_id: z.string().uuid(),
  user_id: z.string().uuid(),
  cadence_days: z.number().nullable(),
  tier_override: z.string().nullable(),
  paused_until: z.string().nullable(),
  last_touched_at: z.string().nullable(),
  next_due_at: z.string().nullable(),
  current_streak_days: z.number().nullable(),
  status: CycleStatus.nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CycleState = z.infer<typeof CycleStateRow>;

export const SpineInboxRow = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  raw_text: z.string(),
  source: InboxSource,
  source_ref: z.string().nullable(),
  captured_at: z.string(),
  parsed: z.boolean(),
  parsed_at: z.string().nullable(),
  parsed_commitment_ids: z.array(z.string().uuid()).nullable(),
  parsed_signal_ids: z.array(z.string().uuid()).nullable(),
  parsed_focus_ids: z.array(z.string().uuid()).nullable(),
  parsed_contact_refs: z.array(z.string().uuid()).nullable(),
  parse_notes: z.string().nullable(),
  deleted_at: z.string().nullable(),
});
export type SpineInbox = z.infer<typeof SpineInboxRow>;

// ==========================
// Input schemas (API request bodies)
// ==========================
export const CaptureInput = z.object({
  raw_text: z.string().min(1).max(4000),
  source: InboxSource.default("dashboard_bar"),
  source_ref: z.string().optional(),
});

export const CommitmentCreate = z.object({
  contact_id: z.string().uuid().nullable().optional(),
  opportunity_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  kind: CommitmentKind.optional(),
  due_at: z.string().datetime().nullable().optional(),
  source: CaptureSource.default("manual"),
  source_ref: z.string().optional(),
});

export const CommitmentUpdate = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  kind: CommitmentKind.optional(),
  due_at: z.string().datetime().nullable().optional(),
  status: CommitmentStatus.optional(),
  delivered_at: z.string().datetime().optional(),
  delivered_via: z.string().optional(),
  notes: z.string().optional(),
});

export const SignalCreate = z.object({
  contact_id: z.string().uuid().nullable().optional(),
  opportunity_id: z.string().uuid().nullable().optional(),
  kind: SignalKind,
  severity: SignalSeverity.default("normal"),
  title: z.string().min(1).max(500),
  detail: z.string().optional(),
  window_start: z.string().optional(),
  window_end: z.string().optional(),
  suggested_action: z.string().optional(),
});

export const SignalUpdate = z.object({
  status: SignalStatus.optional(),
  severity: SignalSeverity.optional(),
  suggested_action: z.string().optional(),
});

export const FocusCreate = z.object({
  contact_id: z.string().uuid(),
  week_of: z.string().optional(), // default current Monday
  rank: z.number().int().min(1).max(10).optional(),
  reason: FocusReason.default("manual"),
  reason_detail: z.string().optional(),
  suggested_action: z.string().optional(),
});

export const FocusUpdate = z.object({
  status: FocusStatus.optional(),
  rank: z.number().int().min(1).max(10).optional(),
  touched_via: z.string().optional(),
  outcome: FocusOutcome.optional(),
  reason_detail: z.string().optional(),
});

export const CycleUpdate = z.object({
  cadence_days: z.number().int().min(1).max(365).nullable().optional(),
  tier_override: z.string().nullable().optional(),
  paused_until: z.string().nullable().optional(),
  status: CycleStatus.optional(),
  notes: z.string().nullable().optional(),
});

// ==========================
// /api/spine/today response
// ==========================
export const TodayPayload = z.object({
  today_focus: z.array(z.object({
    focus: FocusQueueRow,
    contact: z.object({
      id: z.string().uuid(),
      first_name: z.string(),
      last_name: z.string(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      headshot_url: z.string().nullable(),
      tier: z.string().nullable(),
    }),
  })),
  overdue_commitments: z.array(CommitmentRow),
  high_signals: z.array(SignalRow),
  coming_due: z.array(z.object({
    cycle: CycleStateRow,
    contact: z.object({
      id: z.string().uuid(),
      first_name: z.string(),
      last_name: z.string(),
    }),
  })),
  week_rotation_summary: z.object({
    total: z.number(),
    pending: z.number(),
    touched: z.number(),
    skipped: z.number(),
    deferred: z.number(),
  }),
  recent_captures: z.array(SpineInboxRow),
  content_calendar: z.array(z.object({
    title: z.string(),
    scheduled_for: z.string(),
    kind: z.string(), // weekly_edge | toolkit | closing_brief
  })),
});
export type TodayPayloadT = z.infer<typeof TodayPayload>;
