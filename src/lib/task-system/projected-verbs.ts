// Verb whitelist that drives the activity_events -> node_events projection.
//
// MIRROR: the same whitelist is inlined in two places inside
// supabase/migrations/20260520194801_task_system_phase0.sql:
//   1. project_activity_to_node_events() trigger function
//   2. rebuild_node_events_from_activity() replay function
//
// If you change one, change all three. A drift means the trigger silently
// skips a verb the application thinks should project, or projects a verb
// the application thinks should not.
//
// Adding a new verb: update this file, update both SQL sites, write a new
// migration, then call public.rebuild_node_events_from_activity() to replay
// historical rows through the new whitelist.

import type { ActivityVerb } from "@/lib/activity/types";

// The shape of the projection rule: verb -> node_events.type mapping.
export const PROJECTED_VERBS = {
  "capture.created":             "captured",
  "capture.promoted.task":       "task_created",
  "capture.promoted.contact":    "contact_created",
  "capture.promoted.touchpoint": "interaction_logged",
  "capture.promoted.event":      "event_logged",
  "interaction.call":            "interaction_logged",
  "interaction.text":            "interaction_logged",
  "interaction.email":           "interaction_logged",
  "interaction.meeting":         "interaction_logged",
  "interaction.broker_open":     "interaction_logged",
  "interaction.lunch":           "interaction_logged",
  "interaction.note":            "interaction_logged",
  "interaction.event":           "interaction_logged",
  "deliverable.shipped":         "shipped",
  "deliverable.briefed":         "briefed",
  "project.updated":             "project_touched",
  "transaction.opened":          "transaction.opened",
  "transaction.under_contract":  "transaction.under_contract",
  "transaction.in_escrow":       "transaction.in_escrow",
  "transaction.closed":          "transaction.closed",
  "transaction.fell_through":    "transaction.fell_through",
  "brief_sent":                  "brief_sent",
} as const satisfies Partial<Record<ActivityVerb | "brief_sent", string>>;

export type ProjectedVerb = keyof typeof PROJECTED_VERBS;
export type ProjectedType = (typeof PROJECTED_VERBS)[ProjectedVerb];

export function isProjectedVerb(verb: string): verb is ProjectedVerb {
  return verb in PROJECTED_VERBS;
}

export function projectVerb(verb: ProjectedVerb): ProjectedType {
  return PROJECTED_VERBS[verb];
}
