"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  campaignSchema,
  campaignStatusValues,
} from "@/lib/validations";


export async function createCampaign(formData: unknown) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const parsed = campaignSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  console.log("[createCampaign] user:", user.id, "data:", data);

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      user_id: user.id,
      name: data.name,
      description: data.description ?? null,
      type: data.type,
      status: data.status ?? "draft",
      step_count: 0,
      enrolled_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("[createCampaign] error:", error.code, error.message, error.details);
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/campaigns");

  return { success: true, id: campaign.id };
}

export async function updateCampaignStatus(id: string, status: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (
    !campaignStatusValues.includes(status as (typeof campaignStatusValues)[number])
  ) {
    return { error: { _form: ["Invalid campaign status"] } };
  }

  const { error } = await supabase
    .from("campaigns")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/campaigns");

  return { success: true };
}
