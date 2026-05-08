// today-v2 type contracts. Live data lives in `./queries.ts`.
// Phase 1 (2026-04-26) Path 2 ship used static data here; Phase 2 swaps to
// live Supabase reads but the type shape stays so component props don't drift.

export type CallTier = "overdue" | "due" | "up";

export type Call = {
  contact_id: string;
  name: string;
  last: string;
  suggest: string;
  tier: CallTier;
};

export type Calls = {
  overdue: Call[];
  due: Call[];
  up: Call[];
};

export type RunwayItem = {
  id?: string;
  who: string;
  kind: "system" | "tier-a" | "draft" | "touchpoint";
  what: string;
  priority: 0 | 1 | 2 | 3;
  action: string;
  tone: "gold" | "crimson";
  href?: string;
  completed_at?: string | null;
};

export type ListingChecklistFlag =
  | "flyer_done"
  | "social_done"
  | "email_done"
  | "note_done";

export type Listing = {
  listing_id?: string;
  agent: string;
  tier: "A" | "B";
  addr: string;
  days: number;
  items: string[];
  done: boolean[];
};

export type Moment = {
  kind: "N" | "C" | "E" | "M";
  what: string;
  meta: string;
  who: string;
  when: string;
};

export type GcalEvent = {
  time: string;
  title: string;
  where: string;
};

export type StatusBarStats = {
  yestCalls: number;
  filesClosed: number;
  newListings: number;
  openActions: number;
  coldTierA: number;
};
