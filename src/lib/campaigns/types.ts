// Slice 3A stub: standard <entity>/types.ts shape for campaigns.
//
// Campaigns own multi-touch nurture flows (auto-enroll on intake, drip
// step scheduling, lifecycle exit). Schema source-of-truth:
// ~/crm/SCHEMA.md and the live Supabase tables (campaigns, campaign_steps,
// campaign_enrollments, enrollment_schedule).
//
// Slice 3B blocker: fold src/lib/campaigns/auto-enroll.ts into this
// directory's actions.ts and add a runner; Slice 5 owns the runner. Both
// tracked in BLOCKERS.md.

export type CampaignRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CampaignInsert = Omit<CampaignRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type CampaignUpdate = Partial<Omit<CampaignRow, "id" | "created_at">>;
