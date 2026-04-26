// Slice 3A stub: standard <entity>/types.ts shape for events.
//
// Events back the calendar bidirectional-sync layer (gcal_event_id round
// trip, dashboard-create/gcal-pull source flag). Schema source-of-truth:
// ~/crm/SCHEMA.md and the live Supabase table.
//
// Slice 3B blocker: promote invite-templates/ contents to top-level
// templates exports here. Tracked in BLOCKERS.md.

export type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  source: string;
  gcal_event_id: string | null;
  project_id: string | null;
  contact_id: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type EventInsert = Omit<EventRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type EventUpdate = Partial<Omit<EventRow, "id" | "created_at">>;
