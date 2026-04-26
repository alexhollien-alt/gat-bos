// Slice 3A stub: standard <entity>/types.ts shape for tickets.
//
// Tickets are the production-work record (a Cypher print job, a co-brand
// review, a one-off marketing build). Schema source-of-truth:
// ~/crm/SCHEMA.md and the live Supabase table.

export type TicketRow = {
  id: string;
  title: string;
  status: string;
  type: string | null;
  owner_contact_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TicketInsert = Omit<TicketRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type TicketUpdate = Partial<Omit<TicketRow, "id" | "created_at">>;
