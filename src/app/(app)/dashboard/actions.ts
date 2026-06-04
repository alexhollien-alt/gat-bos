"use server";

// Server actions for the 3-tab dashboard. The only three writes in this
// surface are logTouch, toggleTask, addTask (Standing Rule 3: undo paths set
// deleted_at, no hard deletes). getScoredContacts runs the recency scorer
// server-side so the browser never pulls the raw event ledger.

import { createClient } from "@/lib/supabase/server";
import { writeEvent } from "@/lib/activity/writeEvent";
import { scoreContacts, type TemperatureRow } from "@/lib/scoring/temperature";

export type ActionResult =
  | { ok: true; id?: string; event_id?: string }
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

// Recency = latest interaction.* event per contact, scored against tier
// cadence. Runs with the cookie client so RLS scopes to the signed-in user.
export async function getScoredContacts(): Promise<TemperatureRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return scoreContacts(supabase);
}

export async function logTouch({
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
    context: { contact_id, type: "call", source: "dashboard-v3" },
  });

  // writeEvent never throws -- on an insert/RLS failure it returns a null id.
  // A null id means the touch was not written, so surface it as a failure
  // (ok:false) and let the optimistic mutation roll back.
  if (!id) return { ok: false, error: "Couldn't log touch" };

  return { ok: true, event_id: id };
}

export async function undoLogTouch({
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

export async function toggleTask({
  task_id,
  completed,
}: {
  task_id: string;
  completed: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (!task_id) return { ok: false, error: "Missing task_id" };

  // tasks_status_check allows: open | done | snoozed | cancelled (verified
  // against the live constraint). "completed" is NOT a valid status here.
  const { error } = await supabase
    .from("tasks")
    .update({
      status: completed ? "done" : "open",
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", task_id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addTask({
  title,
}: {
  title: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Empty task" };

  // tasks.account_id is NOT NULL with no default; resolve before inserting.
  const account_id = await resolveAccountId(supabase, user.id);
  if (!account_id) return { ok: false, error: "No account on file" };

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      account_id,
      title: trimmed,
      type: "todo",
      status: "open",
      priority: "medium",
      source: "dashboard-v3",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to add task" };
  }
  return { ok: true, id: data.id as string };
}
