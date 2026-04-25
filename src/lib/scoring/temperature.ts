// Phase 1 morning brief -- relationship temperature scoring.
// Ranks Tier A/B/C contacts by drift from their cadence target, with a
// warmth credit for active escrows. Coldest first (highest effective_drift).
//
// Touchpoint source: the `interactions` view (Slice 3 view rewrite,
// 20260425120000_slice3_view_rewrite_drop_legacy.sql). It projects from
// `activity_events` where `verb LIKE 'interaction.%'`, extracts `contact_id`
// out of `context`, and already filters `deleted_at IS NULL`. Querying the
// view gives us a clean contact-id surface without re-implementing the JSONB
// extraction or the dual `(object_table='contacts')` /
// `(object_table='interactions' AND context.contact_id=...)` shape that the
// raw ledger holds.

import type { SupabaseClient } from "@supabase/supabase-js";

export const CADENCE = { A: 5, B: 10, C: 14 } as const;

const NEVER_TOUCHED_DRIFT = 1000;
const ESCROW_WARMTH_DAYS = 3;
const ACTIVE_ESCROW_STAGES = ["under_contract", "in_escrow"] as const;
const SCORED_TIERS = ["A", "B", "C"] as const;

export type Tier = (typeof SCORED_TIERS)[number];

export type TemperatureRow = {
  contact_id: string;
  full_name: string;
  brokerage: string | null;
  tier: Tier;
  days_since_last_touchpoint: number | null;
  last_touchpoint_type: string | null;
  tier_target: number;
  drift: number;
  active_escrows: number;
  effective_drift: number;
};

export async function scoreContacts(
  admin: SupabaseClient,
  options: { now?: Date } = {},
): Promise<TemperatureRow[]> {
  const nowMs = (options.now ?? new Date()).getTime();

  const { data: contacts, error: contactsErr } = await admin
    .from("contacts")
    .select("id, full_name, brokerage, tier")
    .in("tier", SCORED_TIERS as unknown as string[])
    .is("deleted_at", null);
  if (contactsErr) throw contactsErr;
  if (!contacts || contacts.length === 0) return [];

  const ids = contacts.map((c) => c.id as string);

  const [eventsRes, oppsRes] = await Promise.all([
    admin
      .from("interactions")
      .select("contact_id, occurred_at, type")
      .in("contact_id", ids)
      .order("occurred_at", { ascending: false })
      .limit(50000),
    admin
      .from("opportunities")
      .select("contact_id, stage")
      .in("contact_id", ids)
      .in("stage", ACTIVE_ESCROW_STAGES as unknown as string[])
      .is("deleted_at", null),
  ]);
  if (eventsRes.error) throw eventsRes.error;
  if (oppsRes.error) throw oppsRes.error;

  const latestEvent = new Map<string, { occurred_at: string; type: string }>();
  for (const e of eventsRes.data ?? []) {
    const id = e.contact_id as string;
    if (!latestEvent.has(id)) {
      latestEvent.set(id, {
        occurred_at: e.occurred_at as string,
        type: (e.type as string | null) ?? "interaction",
      });
    }
  }

  const escrowCounts = new Map<string, number>();
  for (const o of oppsRes.data ?? []) {
    const id = o.contact_id as string;
    escrowCounts.set(id, (escrowCounts.get(id) ?? 0) + 1);
  }

  const rows: TemperatureRow[] = contacts.map((c) => {
    const tier = c.tier as Tier;
    const tier_target = CADENCE[tier];
    const evt = latestEvent.get(c.id as string);

    let days_since_last_touchpoint: number | null = null;
    let last_touchpoint_type: string | null = null;
    let drift: number;

    if (evt) {
      const ageMs = nowMs - new Date(evt.occurred_at).getTime();
      days_since_last_touchpoint = Math.max(0, Math.floor(ageMs / 86_400_000));
      last_touchpoint_type = evt.type;
      drift = days_since_last_touchpoint - tier_target;
    } else {
      drift = NEVER_TOUCHED_DRIFT;
    }

    const active_escrows = escrowCounts.get(c.id as string) ?? 0;
    const effective_drift = drift - active_escrows * ESCROW_WARMTH_DAYS;

    return {
      contact_id: c.id as string,
      full_name: ((c.full_name as string | null) ?? "").trim(),
      brokerage: (c.brokerage as string | null) ?? null,
      tier,
      days_since_last_touchpoint,
      last_touchpoint_type,
      tier_target,
      drift,
      active_escrows,
      effective_drift,
    };
  });

  rows.sort((a, b) => b.effective_drift - a.effective_drift);
  return rows;
}
