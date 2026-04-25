// Slice 3A stub: standard <entity>/types.ts shape for contacts.
//
// Contacts are the canonical CRM record (agents, lender partners, GAT
// staff). Schema source-of-truth: ~/crm/SCHEMA.md and the live Supabase
// table. A richer Contact type already exists at src/lib/types.ts -- this
// file holds the standard Row/Insert/Update triple for the new lib shape;
// future slices may consolidate or re-export from src/lib/types.ts.

export type ContactRow = {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  stage: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ContactInsert = Omit<ContactRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ContactUpdate = Partial<Omit<ContactRow, "id" | "created_at">>;
