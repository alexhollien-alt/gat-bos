// Slice 3A stub: standard <entity>/types.ts shape for captures.
//
// Captures are unstructured intake (Alex pastes a meeting note, the
// parser proposes a contact + intent). The richer Capture/CapturePayload
// types live in src/lib/types.ts; this file holds the standard
// Row/Insert/Update triple to satisfy the new lib shape. Future slices
// may consolidate or re-export from src/lib/types.ts.
//
// Slice 3B blocker: rename existing parse.ts -> rules.ts, fold promote.ts
// -> actions.ts. Tracked in BLOCKERS.md.

export type CaptureRow = {
  id: string;
  user_id: string;
  raw_text: string;
  parsed_intent: string | null;
  parsed_contact_id: string | null;
  parsed_payload: Record<string, unknown> | null;
  processed: boolean;
  created_at: string;
  updated_at: string;
};

export type CaptureInsert = Omit<CaptureRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type CaptureUpdate = Partial<Omit<CaptureRow, "id" | "created_at">>;
