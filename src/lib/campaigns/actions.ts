// Slice 3B Task 6c: auto-enroll.ts folded into actions.ts. Body preserved
// verbatim from src/lib/campaigns/auto-enroll.ts; no behavior change.

// Auto-enrollment helper for the "New Agent Onboarding" campaign.
//
// Called from every contact-creation surface (POST /api/contacts, intake, modal
// via a server endpoint). Fire-and-forget: enrollment failures never block
// contact creation. If the campaign doesn't exist yet, returns silently so the
// feature is safe to ship before Alex creates the campaign in the UI.

import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/error-log";

const CAMPAIGN_NAME = "New Agent Onboarding";

type AutoEnrollResult =
  | { status: "enrolled"; enrollmentId: string }
  | { status: "skipped"; reason: string };

export async function autoEnrollNewAgent(
  supabase: SupabaseClient,
  contactId: string,
  ownerUserId: string,
): Promise<AutoEnrollResult> {
  try {
    // 1) Contact must be a realtor. Read live DB; don't trust call sites.
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      .select("id, type, deleted_at")
      .eq("id", contactId)
      .maybeSingle();
    if (contactErr || !contact) {
      return { status: "skipped", reason: "contact_not_found" };
    }
    if (contact.deleted_at) {
      return { status: "skipped", reason: "contact_deleted" };
    }
    if (contact.type !== "realtor") {
      return { status: "skipped", reason: "not_realtor" };
    }

    // 2) Look up the campaign under this owner. Scoped by name + user_id +
    //    status='active' so draft/paused/archived copies don't trigger.
    const { data: campaign, error: campaignErr } = await supabase
      .from("campaigns")
      .select("id")
      .eq("user_id", ownerUserId)
      .eq("name", CAMPAIGN_NAME)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();
    if (campaignErr || !campaign) {
      return { status: "skipped", reason: "campaign_not_found" };
    }

    // 3) Read step 1 to compute next_action_at.
    const { data: step1, error: stepErr } = await supabase
      .from("campaign_steps")
      .select("delay_days")
      .eq("campaign_id", campaign.id)
      .eq("step_number", 1)
      .is("deleted_at", null)
      .maybeSingle();
    if (stepErr || !step1) {
      return { status: "skipped", reason: "step_1_not_found" };
    }

    const nextActionAt = new Date(
      Date.now() + (step1.delay_days ?? 0) * 86_400_000,
    ).toISOString();

    // 4) Insert enrollment. ON CONFLICT (campaign_id, contact_id) DO NOTHING
    //    via upsert with ignoreDuplicates so re-saves of the same contact
    //    don't spawn duplicate enrollments.
    const { data: inserted, error: insertErr } = await supabase
      .from("campaign_enrollments")
      .upsert(
        [
          {
            campaign_id: campaign.id,
            contact_id: contactId,
            status: "active",
            current_step: 1,
            next_action_at: nextActionAt,
          },
        ],
        { onConflict: "campaign_id,contact_id", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();

    if (insertErr) {
      await logError("auto-enroll", insertErr.message, {
        contactId,
        campaignId: campaign.id,
      });
      return { status: "skipped", reason: "insert_failed" };
    }

    // 5) If a new row landed, bump enrolled_count. Upserts that hit the unique
    //    constraint and get ignored return no row; skip the count update in
    //    that case. Race with concurrent enrollments is acceptable -- same
    //    pattern as the existing manual enrollContacts() action.
    if (inserted?.id) {
      const { count } = await supabase
        .from("campaign_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .is("deleted_at", null)
        .neq("status", "removed");

      if (typeof count === "number") {
        await supabase
          .from("campaigns")
          .update({ enrolled_count: count })
          .eq("id", campaign.id);
      }

      return { status: "enrolled", enrollmentId: inserted.id };
    }

    return { status: "skipped", reason: "already_enrolled" };
  } catch (err) {
    await logError(
      "auto-enroll",
      err instanceof Error ? err.message : String(err),
      { contactId },
    );
    return { status: "skipped", reason: "exception" };
  }
}
