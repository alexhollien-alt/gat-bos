// Phase 1 morning brief -- relationship temperature scoring.
// Phase 4 (idempotent-toasting-tome): drift formula now weighs deliverable
// recency from `deliverable.shipped` activity events AND active transaction
// stage from the latest non-terminal `transaction.*` event per contact.
//
// Touchpoint source: the `interactions` view (Slice 3 view rewrite,
// 20260425120000_slice3_view_rewrite_drop_legacy.sql). It projects from
// `activity_events` where `verb LIKE 'interaction.%'`, extracts `contact_id`
// out of `context`, and already filters `deleted_at IS NULL`.
//
// Deliverable source: `activity_events` where verb = 'deliverable.shipped'
// and context->>'contact_id' is non-null. Vault frontmatter backfill is open
// (Phase 2 handoff item #2); contacts without a per-event contact_id get no
// deliverable credit and fall back to touchpoint-only ranking.
//
// Transaction source: `activity_events` where verb LIKE 'transaction.%' and
// context->>'contact_id' is non-null. Latest event per contact_id wins; if
// the latest verb is terminal (closed | fell_through), the contact has no
// active transaction.
//
// Drift formula (Phase 4):
//   cadence_floor       = CADENCE[tier]
//   days_since_touch    = today - last_touchpoint  (null -> never touched)
//   days_since_delivery = today - last_deliverable_at  (null -> never)
//   effective_age       = min(days_since_touch, days_since_delivery)
//   drift               = effective_age - cadence_floor
//   if active_transaction_stage in ('in_escrow','under_contract'): drift -= 3
//   if active_transaction_stage == 'in_escrow' AND
//      expected_close_date within 7 days:                          drift -= 5
//   never-touched + never-delivered: drift = NEVER_TOUCHED_DRIFT (1000)

import type { SupabaseClient } from "@supabase/supabase-js";

export const CADENCE = { A: 5, B: 10, C: 14 } as const;

const NEVER_TOUCHED_DRIFT = 1000;
const ACTIVE_ESCROW_BONUS = 3;
const IMMINENT_CLOSE_BONUS = 5;
const IMMINENT_CLOSE_WINDOW_DAYS = 7;
const ACTIVE_STAGES = ["under_contract", "in_escrow"] as const;
const TERMINAL_STAGES = ["closed", "fell_through"] as const;
export const SCORED_TIERS = ["A", "B", "C"] as const;

export type Tier = (typeof SCORED_TIERS)[number];

export type ActiveTransactionStage =
  | "opened"
  | "under_contract"
  | "in_escrow";

const VERB_TO_STAGE: Record<string, ActiveTransactionStage | "terminal"> = {
  "transaction.opened": "opened",
  "transaction.under_contract": "under_contract",
  "transaction.in_escrow": "in_escrow",
  "transaction.closed": "terminal",
  "transaction.fell_through": "terminal",
};

export type TemperatureRow = {
  contact_id: string;
  full_name: string;
  brokerage: string | null;
  tier: Tier;
  days_since_last_touchpoint: number | null;
  last_touchpoint_type: string | null;
  days_since_last_deliverable: number | null;
  active_transaction_stage: ActiveTransactionStage | null;
  expected_close_date: string | null;
  tier_target: number;
  drift: number;
  active_escrows: number;
  effective_drift: number;
};

export type ScoreInput = {
  tier: Tier;
  last_touchpoint_at: string | null;
  last_deliverable_at: string | null;
  active_transaction_stage: ActiveTransactionStage | null;
  expected_close_date: string | null;
  now: Date;
};

export type ScoreOutput = {
  days_since_last_touchpoint: number | null;
  days_since_last_deliverable: number | null;
  tier_target: number;
  drift: number;
  active_escrows: number;
  effective_drift: number;
};

const MS_PER_DAY = 86_400_000;

function daysBetween(now: Date, iso: string | null): number | null {
  if (!iso) return null;
  const ageMs = now.getTime() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ageMs / MS_PER_DAY));
}

function daysUntil(now: Date, iso: string | null): number | null {
  if (!iso) return null;
  // expected_close_date is a DATE (no time), so compare midnight-to-midnight.
  const target = new Date(iso + "T00:00:00Z").getTime();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).getTime();
  return Math.floor((target - today) / MS_PER_DAY);
}

export function score(input: ScoreInput): ScoreOutput {
  const tier_target = CADENCE[input.tier];
  const days_since_last_touchpoint = daysBetween(input.now, input.last_touchpoint_at);
  const days_since_last_deliverable = daysBetween(input.now, input.last_deliverable_at);

  let drift: number;
  if (days_since_last_touchpoint === null && days_since_last_deliverable === null) {
    drift = NEVER_TOUCHED_DRIFT;
  } else {
    const candidates = [days_since_last_touchpoint, days_since_last_deliverable]
      .filter((v): v is number => v !== null);
    const effective_age = Math.min(...candidates);
    drift = effective_age - tier_target;
  }

  const stage = input.active_transaction_stage;
  const has_active = stage === "in_escrow" || stage === "under_contract";
  const active_escrows = has_active ? 1 : 0;

  let effective_drift = drift;
  if (has_active) effective_drift -= ACTIVE_ESCROW_BONUS;
  if (stage === "in_escrow") {
    const days_to_close = daysUntil(input.now, input.expected_close_date);
    if (
      days_to_close !== null &&
      days_to_close >= 0 &&
      days_to_close <= IMMINENT_CLOSE_WINDOW_DAYS
    ) {
      effective_drift -= IMMINENT_CLOSE_BONUS;
    }
  }

  return {
    days_since_last_touchpoint,
    days_since_last_deliverable,
    tier_target,
    drift,
    active_escrows,
    effective_drift,
  };
}

export async function scoreContacts(
  admin: SupabaseClient,
  options: { now?: Date } = {},
): Promise<TemperatureRow[]> {
  const now = options.now ?? new Date();

  const { data: contacts, error: contactsErr } = await admin
    .from("contacts")
    .select("id, full_name, brokerage, tier")
    .in("tier", SCORED_TIERS as unknown as string[])
    .is("deleted_at", null);
  if (contactsErr) throw contactsErr;
  if (!contacts || contacts.length === 0) return [];

  const ids = contacts.map((c) => c.id as string);

  const [eventsRes, deliverableRes, transactionRes] = await Promise.all([
    admin
      .from("interactions")
      .select("contact_id, occurred_at, type")
      .in("contact_id", ids)
      .order("occurred_at", { ascending: false })
      .limit(50000),
    admin
      .from("activity_events")
      .select("context, occurred_at")
      .eq("verb", "deliverable.shipped")
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .limit(50000),
    admin
      .from("activity_events")
      .select("context, occurred_at, verb")
      .like("verb", "transaction.%")
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .limit(50000),
  ]);
  if (eventsRes.error) throw eventsRes.error;
  if (deliverableRes.error) throw deliverableRes.error;
  if (transactionRes.error) throw transactionRes.error;

  const idSet = new Set(ids);

  const latestTouch = new Map<string, { occurred_at: string; type: string }>();
  for (const e of eventsRes.data ?? []) {
    const id = e.contact_id as string;
    if (!latestTouch.has(id)) {
      latestTouch.set(id, {
        occurred_at: e.occurred_at as string,
        type: (e.type as string | null) ?? "interaction",
      });
    }
  }

  const latestDeliverable = new Map<string, string>();
  for (const e of deliverableRes.data ?? []) {
    const ctx = (e.context as Record<string, unknown> | null) ?? {};
    const cid = ctx.contact_id;
    if (typeof cid !== "string" || !idSet.has(cid)) continue;
    if (!latestDeliverable.has(cid)) {
      latestDeliverable.set(cid, e.occurred_at as string);
    }
  }

  type LatestTx = {
    stage: ActiveTransactionStage | null;
    expected_close_date: string | null;
  };
  const latestTransaction = new Map<string, LatestTx>();
  for (const e of transactionRes.data ?? []) {
    const ctx = (e.context as Record<string, unknown> | null) ?? {};
    const cid = ctx.contact_id;
    if (typeof cid !== "string" || !idSet.has(cid)) continue;
    if (latestTransaction.has(cid)) continue;
    const mapped = VERB_TO_STAGE[e.verb as string];
    if (!mapped) continue;
    const stage = mapped === "terminal" ? null : mapped;
    const ecd = ctx.expected_close_date;
    latestTransaction.set(cid, {
      stage,
      expected_close_date: typeof ecd === "string" ? ecd : null,
    });
  }

  const rows: TemperatureRow[] = contacts.map((c) => {
    const id = c.id as string;
    const tier = c.tier as Tier;
    const evt = latestTouch.get(id) ?? null;
    const tx = latestTransaction.get(id) ?? null;

    const result = score({
      tier,
      last_touchpoint_at: evt?.occurred_at ?? null,
      last_deliverable_at: latestDeliverable.get(id) ?? null,
      active_transaction_stage: tx?.stage ?? null,
      expected_close_date: tx?.expected_close_date ?? null,
      now,
    });

    return {
      contact_id: id,
      full_name: ((c.full_name as string | null) ?? "").trim(),
      brokerage: (c.brokerage as string | null) ?? null,
      tier,
      days_since_last_touchpoint: result.days_since_last_touchpoint,
      last_touchpoint_type: evt?.type ?? null,
      days_since_last_deliverable: result.days_since_last_deliverable,
      active_transaction_stage: tx?.stage ?? null,
      expected_close_date: tx?.expected_close_date ?? null,
      tier_target: result.tier_target,
      drift: result.drift,
      active_escrows: result.active_escrows,
      effective_drift: result.effective_drift,
    };
  });

  rows.sort((a, b) => b.effective_drift - a.effective_drift);
  return rows;
}

export const __TEST__ = {
  ACTIVE_STAGES,
  TERMINAL_STAGES,
  NEVER_TOUCHED_DRIFT,
  ACTIVE_ESCROW_BONUS,
  IMMINENT_CLOSE_BONUS,
  IMMINENT_CLOSE_WINDOW_DAYS,
};
