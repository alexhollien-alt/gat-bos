// Slice 3A stub: standard <entity>/types.ts shape for tasks.
//
// Task rows are a lightweight to-do unit attached to contacts or projects.
// Schema source-of-truth: ~/crm/SCHEMA.md and the live Supabase table.

export type TaskRow = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  contact_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TaskInsert = Omit<TaskRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type TaskUpdate = Partial<Omit<TaskRow, "id" | "created_at">>;
