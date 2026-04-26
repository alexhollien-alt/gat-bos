// Slice 3A stub: standard <entity>/types.ts shape for projects.
//
// Project rows (public.projects) drive the multi-touchpoint container that
// groups events, drafts, and other CRM activity under one parent record.
// Schema source-of-truth: ~/crm/SCHEMA.md and the live Supabase table.
// These types are intentionally narrow placeholders. Future slices flesh
// them out as actions/queries land here.

export type ProjectRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  owner_contact_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ProjectInsert = Omit<ProjectRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ProjectUpdate = Partial<Omit<ProjectRow, "id" | "created_at">>;
