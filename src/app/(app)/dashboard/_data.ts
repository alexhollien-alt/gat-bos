// Shared read helpers for the 3-tab dashboard. Plain module (no "use client"
// / "use server") so both the server prefetch in page.tsx (cookie-bound RLS
// client) and the client hooks in queries.ts (browser client) call the exact
// same query functions under identical keys -> seamless hydration.
//
// Recency is NOT read from contacts.last_touchpoint (a one-way denormalized
// legacy field, untouched since the 20260426120000 backfill). The live source
// of truth for "days since last contact" is activity_events, scored by
// scoreContacts() in @/lib/scoring/temperature. See actions.getScoredContacts.

import type { SupabaseClient } from "@supabase/supabase-js";

export type OpenTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  contact_id: string | null;
};

export type Counters = { touches: number; tasksDone: number };

export type ProspectRow = {
  id: string;
  full_name: string | null;
  brokerage: string | null;
  tier: string | null;
};

export type WeeklyStats = {
  calls: number;
  openHouses: number;
  meetings: number;
  bni: number;
};

// "Today" in Phoenix (fixed UTC-7, no DST). Phoenix midnight == 07:00 UTC.
// Shift now by -7h then read UTC fields so the boundary is timezone-safe
// regardless of the server's local zone.
export function todayPhoenixWindow(): { start: string; end: string } {
  const phx = new Date(Date.now() - 7 * 60 * 60 * 1000);
  const start = new Date(
    Date.UTC(phx.getUTCFullYear(), phx.getUTCMonth(), phx.getUTCDate(), 7, 0, 0),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function fetchOpenTasks(
  supabase: SupabaseClient,
): Promise<OpenTask[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status, due_date, completed_at, contact_id")
    .eq("status", "open")
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OpenTask[];
}

export async function fetchCounters(
  supabase: SupabaseClient,
): Promise<Counters> {
  const { start, end } = todayPhoenixWindow();
  const [touchRes, doneRes] = await Promise.all([
    supabase
      .from("activity_events")
      .select("id", { count: "exact", head: true })
      .eq("verb", "interaction.call")
      .is("deleted_at", null)
      .gte("occurred_at", start)
      .lt("occurred_at", end),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "done")
      .is("deleted_at", null)
      .gte("completed_at", start)
      .lt("completed_at", end),
  ]);
  if (touchRes.error) throw new Error(touchRes.error.message);
  if (doneRes.error) throw new Error(doneRes.error.message);
  return { touches: touchRes.count ?? 0, tasksDone: doneRes.count ?? 0 };
}

export async function fetchProspects(
  supabase: SupabaseClient,
): Promise<ProspectRow[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, full_name, brokerage, tier")
    .eq("tier", "P")
    .is("deleted_at", null)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProspectRow[];
}

export async function fetchWeekly(
  supabase: SupabaseClient,
): Promise<WeeklyStats> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const countVerb = async (verb: string): Promise<number> => {
    const { count, error } = await supabase
      .from("activity_events")
      .select("id", { count: "exact", head: true })
      .eq("verb", verb)
      .is("deleted_at", null)
      .gte("occurred_at", since);
    if (error) throw new Error(error.message);
    return count ?? 0;
  };
  const [calls, openHouses, meetings, bni] = await Promise.all([
    countVerb("interaction.call"),
    countVerb("interaction.broker_open"),
    countVerb("interaction.meeting"),
    // TODO(alex): BNI follow-ups have no dedicated verb. interaction.note is a
    // stand-in proxy until a real BNI tracking source is defined.
    countVerb("interaction.note"),
  ]);
  return { calls, openHouses, meetings, bni };
}
