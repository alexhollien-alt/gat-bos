// Cadence side-effects for /api/captures target=task_system.
//
// Per Proposal A in the plan file: cadence updates live in the application
// layer, not in the node_events projection trigger. Reason: cadence math
// depends on per-contact tier and configurable target_days; explicit at the
// call site is clearer than embedded in a DB trigger.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TIER_TARGET_DAYS,
  type ContactTier,
} from "@/lib/types/task-system";

export interface CreateCadenceInput {
  client: SupabaseClient;
  contactId: string;
  tier: ContactTier;
}

export async function createCadence(input: CreateCadenceInput): Promise<void> {
  const { client, contactId, tier } = input;
  const targetDays = TIER_TARGET_DAYS[tier];
  const now = new Date();
  const nextDue = new Date(now.getTime() + targetDays * 24 * 60 * 60 * 1000);

  await client.from("cadences").upsert(
    {
      contact_id: contactId,
      tier,
      target_days: targetDays,
      last_touched_at: now.toISOString(),
      next_due_at: nextDue.toISOString(),
    },
    { onConflict: "contact_id" },
  );
}

export interface TouchCadenceInput {
  client: SupabaseClient;
  contactId: string;
}

// Recompute cadence on a new interaction. Uses the cadence row's current
// target_days. If no cadence row exists for this contact (interaction logged
// against a contact that was never tiered), this is a no-op; the caller has
// already emitted an unresolved_contact warning in that case.
export async function touchCadenceForInteraction(
  input: TouchCadenceInput,
): Promise<{ touched: boolean }> {
  const { client, contactId } = input;

  const { data: existing } = await client
    .from("cadences")
    .select("target_days")
    .eq("contact_id", contactId)
    .maybeSingle();

  if (!existing) {
    return { touched: false };
  }

  const now = new Date();
  const nextDue = new Date(now.getTime() + (existing.target_days as number) * 24 * 60 * 60 * 1000);

  const { error } = await client
    .from("cadences")
    .update({
      last_touched_at: now.toISOString(),
      next_due_at: nextDue.toISOString(),
    })
    .eq("contact_id", contactId);

  if (error) return { touched: false };
  return { touched: true };
}
