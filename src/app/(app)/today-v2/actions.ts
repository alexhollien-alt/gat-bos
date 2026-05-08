"use server";

// Server Actions for /today-v2 CallRow buttons (Phase 011).
// `interactions` is a read-only VIEW over activity_events; writes go via writeEvent.
// `tasks.account_id` is NOT NULL post-Slice 7B; resolved from accounts.owner_user_id.

import { createClient } from "@/lib/supabase/server";
import { writeEvent } from "@/lib/activity/writeEvent";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}

export async function logCallTouch({
  contact_id,
}: {
  contact_id: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (!contact_id) return { ok: false, error: "Missing contact_id" };

  await writeEvent({
    userId: user.id,
    actorId: user.id,
    verb: "interaction.call",
    object: { table: "contacts", id: contact_id },
    context: {
      contact_id,
      type: "call",
      source: "today-v2",
    },
  });

  return { ok: true };
}

export async function queueCall({
  contact_id,
}: {
  contact_id: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (!contact_id) return { ok: false, error: "Missing contact_id" };

  const account_id = await resolveAccountId(supabase, user.id);
  if (!account_id) return { ok: false, error: "No account on file" };

  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      account_id,
      contact_id,
      type: "follow_up",
      source: "today-v2",
      title: "Call follow-up",
      due_reason: "Queued from /today-v2 CallRow",
      due_date: dueDate,
      status: "open",
      priority: "medium",
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Failed to insert task",
    };
  }

  return { ok: true, id: data.id as string };
}
