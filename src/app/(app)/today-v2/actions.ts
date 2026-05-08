"use server";

// Server Actions for /today-v2 CallRow buttons (Phase 011 + 012).
// `interactions` is a read-only VIEW over activity_events; writes go via writeEvent.
// `tasks.account_id` is NOT NULL post-Slice 7B; resolved from accounts.owner_user_id.
// Phase 012: undo paths set deleted_at only (Standing Rule 3, no hard deletes).

import { createClient } from "@/lib/supabase/server";
import { writeEvent } from "@/lib/activity/writeEvent";

export type ActionResult =
  | { ok: true; id?: string; event_id?: string }
  | { ok: false; error: string };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayPhoenixDateString(): string {
  const now = new Date();
  const phx = new Date(now.getTime() - 7 * 60 * 60 * 1000);
  const yyyy = phx.getUTCFullYear();
  const mm = String(phx.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(phx.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function tomorrowPhoenixDateString(): string {
  const now = new Date();
  const phx = new Date(now.getTime() - 7 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
  const yyyy = phx.getUTCFullYear();
  const mm = String(phx.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(phx.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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

  const { id } = await writeEvent({
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

  return { ok: true, event_id: id ?? undefined };
}

export async function queueCall({
  contact_id,
  due_date,
}: {
  contact_id: string;
  due_date?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (!contact_id) return { ok: false, error: "Missing contact_id" };

  let dueDate: string;
  if (due_date) {
    if (!ISO_DATE_RE.test(due_date)) {
      return { ok: false, error: "Invalid date format" };
    }
    if (due_date < todayPhoenixDateString()) {
      return { ok: false, error: "Due date in the past" };
    }
    dueDate = due_date;
  } else {
    dueDate = tomorrowPhoenixDateString();
  }

  const account_id = await resolveAccountId(supabase, user.id);
  if (!account_id) return { ok: false, error: "No account on file" };

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

export async function undoLogCallTouch({
  event_id,
}: {
  event_id: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (!event_id) return { ok: false, error: "Missing event_id" };

  const { error } = await supabase
    .from("activity_events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", event_id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function undoQueueCall({
  task_id,
}: {
  task_id: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (!task_id) return { ok: false, error: "Missing task_id" };

  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", task_id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
