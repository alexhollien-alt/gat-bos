"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { campaignSchema } from "@/lib/validations";
import { z } from "zod";

const stepSchema = z.object({
  campaign_id: z.string().uuid(),
  step_number: z.number().int().min(1),
  step_type: z.enum(["email", "call", "text", "mail", "social", "task"]),
  title: z.string().min(1, "Step title is required"),
  content: z.string().optional(),
  delay_days: z.number().int().min(0).default(0),
  email_subject: z.string().optional(),
  email_body_html: z.string().optional(),
});

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function addStep(formData: unknown) {
  const { supabase } = await getAuthUser();

  const parsed = stepSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  const { error } = await supabase.from("campaign_steps").insert({
    campaign_id: data.campaign_id,
    step_number: data.step_number,
    step_type: data.step_type,
    title: data.title,
    content: data.content ?? null,
    delay_days: data.delay_days,
    email_subject: data.email_subject ?? null,
    email_body_html: data.email_body_html ?? null,
  });

  if (error) {
    return { error: { _form: [error.message] } };
  }

  // Update step_count on campaign
  const { data: steps } = await supabase
    .from("campaign_steps")
    .select("id")
    .eq("campaign_id", data.campaign_id)
    .is("deleted_at", null);

  await supabase
    .from("campaigns")
    .update({ step_count: steps?.length ?? 0 })
    .eq("id", data.campaign_id);

  revalidatePath(`/campaigns/${data.campaign_id}`);
  return { success: true };
}

export async function updateStep(
  stepId: string,
  campaignId: string,
  formData: unknown
) {
  const { supabase } = await getAuthUser();

  const updateSchema = z.object({
    step_type: z.enum(["email", "call", "text", "mail", "social", "task"]),
    title: z.string().min(1),
    content: z.string().optional(),
    delay_days: z.number().int().min(0),
    email_subject: z.string().optional(),
    email_body_html: z.string().optional(),
  });

  const parsed = updateSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  const { error } = await supabase
    .from("campaign_steps")
    .update({
      step_type: data.step_type,
      title: data.title,
      content: data.content ?? null,
      delay_days: data.delay_days,
      email_subject: data.email_subject ?? null,
      email_body_html: data.email_body_html ?? null,
    })
    .eq("id", stepId);

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath(`/campaigns/${campaignId}`);
  return { success: true };
}

export async function deleteStep(stepId: string, campaignId: string) {
  const { supabase } = await getAuthUser();

  const { error } = await supabase
    .from("campaign_steps")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", stepId);

  if (error) {
    return { error: { _form: [error.message] } };
  }

  // Recount and renumber
  const { data: steps } = await supabase
    .from("campaign_steps")
    .select("id")
    .eq("campaign_id", campaignId)
    .is("deleted_at", null)
    .order("step_number", { ascending: true });

  await supabase
    .from("campaigns")
    .update({ step_count: steps?.length ?? 0 })
    .eq("id", campaignId);

  revalidatePath(`/campaigns/${campaignId}`);
  return { success: true };
}

export async function reorderSteps(
  campaignId: string,
  stepIds: string[]
) {
  const { supabase } = await getAuthUser();

  for (let i = 0; i < stepIds.length; i++) {
    await supabase
      .from("campaign_steps")
      .update({ step_number: i + 1 })
      .eq("id", stepIds[i]);
  }

  revalidatePath(`/campaigns/${campaignId}`);
  return { success: true };
}

export async function updateCampaign(
  campaignId: string,
  formData: unknown
) {
  const { supabase } = await getAuthUser();

  const parsed = campaignSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  const { error } = await supabase
    .from("campaigns")
    .update({
      name: data.name,
      description: data.description ?? null,
      type: data.type,
      status: data.status,
    })
    .eq("id", campaignId);

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  return { success: true };
}

export async function deleteCampaign(campaignId: string) {
  const { supabase } = await getAuthUser();

  const { error } = await supabase
    .from("campaigns")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", campaignId);

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/campaigns");
  return { success: true };
}

// ---------------------
// Enrollment Actions
// ---------------------

export async function enrollContacts(
  campaignId: string,
  contactIds: string[]
) {
  const { supabase } = await getAuthUser();

  const rows = contactIds.map((contactId) => ({
    campaign_id: campaignId,
    contact_id: contactId,
    status: "active" as const,
    current_step: 1,
  }));

  const { error } = await supabase
    .from("campaign_enrollments")
    .upsert(rows, { onConflict: "campaign_id,contact_id", ignoreDuplicates: true });

  if (error) {
    return { error: { _form: [error.message] } };
  }

  // Update enrolled_count
  const { data: enrollments } = await supabase
    .from("campaign_enrollments")
    .select("id")
    .eq("campaign_id", campaignId)
    .is("deleted_at", null)
    .neq("status", "removed");

  await supabase
    .from("campaigns")
    .update({ enrolled_count: enrollments?.length ?? 0 })
    .eq("id", campaignId);

  revalidatePath(`/campaigns/${campaignId}`);
  return { success: true };
}

export async function removeEnrollment(
  enrollmentId: string,
  campaignId: string
) {
  const { supabase } = await getAuthUser();

  const { error } = await supabase
    .from("campaign_enrollments")
    .update({ status: "removed" })
    .eq("id", enrollmentId);

  if (error) {
    return { error: { _form: [error.message] } };
  }

  const { data: enrollments } = await supabase
    .from("campaign_enrollments")
    .select("id")
    .eq("campaign_id", campaignId)
    .is("deleted_at", null)
    .neq("status", "removed");

  await supabase
    .from("campaigns")
    .update({ enrolled_count: enrollments?.length ?? 0 })
    .eq("id", campaignId);

  revalidatePath(`/campaigns/${campaignId}`);
  return { success: true };
}

export async function completeStep(
  enrollmentId: string,
  stepId: string,
  campaignId: string,
  notes?: string
) {
  const { supabase, user } = await getAuthUser();

  const { error: completionError } = await supabase
    .from("campaign_step_completions")
    .insert({
      enrollment_id: enrollmentId,
      step_id: stepId,
      completed_by: user.id,
      notes: notes ?? null,
    });

  if (completionError) {
    return { error: { _form: [completionError.message] } };
  }

  const { data: enrollment } = await supabase
    .from("campaign_enrollments")
    .select("current_step")
    .eq("id", enrollmentId)
    .single();

  const { data: totalSteps } = await supabase
    .from("campaign_steps")
    .select("id")
    .eq("campaign_id", campaignId)
    .is("deleted_at", null);

  const currentStep = enrollment?.current_step ?? 0;
  const isLastStep = currentStep >= (totalSteps?.length ?? 0);

  if (isLastStep) {
    await supabase
      .from("campaign_enrollments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        next_action_at: null,
      })
      .eq("id", enrollmentId);
  } else {
    // Look up the next step's delay_days so we can roll next_action_at forward.
    // If missing (step gap / data issue), leave next_action_at as the previous
    // value rather than clearing it -- dispatcher will still pick up the row.
    const nextStepNumber = currentStep + 1;
    const { data: nextStep } = await supabase
      .from("campaign_steps")
      .select("delay_days")
      .eq("campaign_id", campaignId)
      .eq("step_number", nextStepNumber)
      .is("deleted_at", null)
      .maybeSingle();

    const update: {
      current_step: number;
      next_action_at?: string;
    } = { current_step: nextStepNumber };
    if (nextStep) {
      update.next_action_at = new Date(
        Date.now() + (nextStep.delay_days ?? 0) * 86_400_000,
      ).toISOString();
    }

    await supabase
      .from("campaign_enrollments")
      .update(update)
      .eq("id", enrollmentId);
  }

  revalidatePath(`/campaigns/${campaignId}`);
  return { success: true };
}

export async function pauseEnrollment(
  enrollmentId: string,
  campaignId: string
) {
  const { supabase } = await getAuthUser();

  await supabase
    .from("campaign_enrollments")
    .update({ status: "paused" })
    .eq("id", enrollmentId);

  revalidatePath(`/campaigns/${campaignId}`);
  return { success: true };
}

export async function resumeEnrollment(
  enrollmentId: string,
  campaignId: string
) {
  const { supabase } = await getAuthUser();

  await supabase
    .from("campaign_enrollments")
    .update({ status: "active" })
    .eq("id", enrollmentId);

  revalidatePath(`/campaigns/${campaignId}`);
  return { success: true };
}
