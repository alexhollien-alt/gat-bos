// Slice 3A stub: standard <entity>/types.ts shape for opportunities.
//
// Opportunities track active deal flow (a listing in negotiation, a
// referral in motion). Schema source-of-truth: ~/crm/SCHEMA.md and the
// live Supabase table.

export type OpportunityRow = {
  id: string;
  title: string;
  status: string;
  stage: string | null;
  contact_id: string | null;
  amount_cents: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type OpportunityInsert = Omit<OpportunityRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type OpportunityUpdate = Partial<Omit<OpportunityRow, "id" | "created_at">>;
