"use client";

// today-v2 live queries. Five hooks back the prototype shells with live
// Supabase reads. Read-only; mutations land in Phase 3.
//
// Realtime: only email_drafts subscribes (Phase 9 dev fix pattern --
// getSession -> setAuth -> subscribe, unique topic per mount). Projects /
// touchpoints / activity_events ride the 30s staleTime; not latency-critical.

import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { logCallTouch, queueCall } from "./actions";
import type {
  Call,
  Calls,
  CallTier,
  Listing,
  ListingChecklistFlag,
  Moment,
  RunwayItem,
  StatusBarStats,
} from "./fixtures";

// Cadence + scoring constants are inlined here. The morning-brief
// `src/lib/scoring/temperature.ts` lives only on a deferred branch (Phase 1
// Morning Brief, ETA after Slice 4 per LATER.md). Once that lands, swap this
// to import { CADENCE } and reuse scoreContacts directly.
type Tier = "A" | "B" | "C";
const CADENCE: Record<Tier, number> = { A: 5, B: 10, C: 14 } as const;

const STALE_MS = 30_000;
const NEVER_TOUCHED_DRIFT = 1000;
const ESCROW_WARMTH_DAYS = 3;
const SCORED_TIERS: Tier[] = ["A", "B", "C"];
const ACTIVE_ESCROW_STAGES = ["under_contract", "in_escrow"] as const;

// ----- Calls Lane ----------------------------------------------------------

type ScoredContact = {
  contact_id: string;
  full_name: string;
  tier: Tier;
  days_since: number | null;
  last_type: string | null;
  effective_drift: number;
  tier_target: number;
};

function suggestForCall(s: ScoredContact, tierBucket: CallTier): string {
  if (tierBucket === "overdue") {
    return s.last_type
      ? `Reconnect, ${s.days_since ?? 0}d since last ${s.last_type.replace(/_/g, " ")}.`
      : `No touch on file. Open the relationship.`;
  }
  if (tierBucket === "due") {
    return `Cadence hits today. Send a personal note or call.`;
  }
  return `Coming up in ${Math.max(0, s.tier_target - (s.days_since ?? 0))}d. Pre-stage a touch.`;
}

function lastLabel(s: ScoredContact): string {
  if (s.days_since == null) return "no touch on file";
  if (s.days_since === 0) return "today";
  return `${s.days_since}d ago`;
}

export function useCallsLane() {
  const supabase = useMemo(() => createClient(), []);
  return useQuery<{ calls: Calls; raw: ScoredContact[] }>({
    queryKey: ["calls-lane"],
    staleTime: STALE_MS,
    queryFn: async () => {
      const nowMs = Date.now();

      const { data: contacts, error: contactsErr } = await supabase
        .from("contacts")
        .select("id, full_name, tier")
        .in("tier", ["A", "B"])
        .is("deleted_at", null);
      if (contactsErr) throw new Error(contactsErr.message);
      if (!contacts || contacts.length === 0) {
        return { calls: { overdue: [], due: [], up: [] }, raw: [] };
      }

      const ids = contacts.map((c) => c.id as string);

      const [eventsRes, oppsRes] = await Promise.all([
        supabase
          .from("interactions")
          .select("contact_id, occurred_at, type")
          .in("contact_id", ids)
          .order("occurred_at", { ascending: false })
          .limit(5000),
        supabase
          .from("opportunities")
          .select("contact_id, stage")
          .in("contact_id", ids)
          .in("stage", ACTIVE_ESCROW_STAGES as unknown as string[])
          .is("deleted_at", null),
      ]);
      if (eventsRes.error) throw new Error(eventsRes.error.message);
      if (oppsRes.error) throw new Error(oppsRes.error.message);

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

      const scored: ScoredContact[] = contacts
        .filter((c) => SCORED_TIERS.includes(c.tier as Tier))
        .map((c) => {
          const tier = c.tier as Tier;
          const tier_target = CADENCE[tier];
          const evt = latestEvent.get(c.id as string);

          let days_since: number | null = null;
          let last_type: string | null = null;
          let drift: number;
          if (evt) {
            const ageMs = nowMs - new Date(evt.occurred_at).getTime();
            days_since = Math.max(0, Math.floor(ageMs / 86_400_000));
            last_type = evt.type;
            drift = days_since - tier_target;
          } else {
            drift = NEVER_TOUCHED_DRIFT;
          }
          const effective_drift =
            drift - (escrowCounts.get(c.id as string) ?? 0) * ESCROW_WARMTH_DAYS;
          return {
            contact_id: c.id as string,
            full_name: ((c.full_name as string | null) ?? "").trim(),
            tier,
            days_since,
            last_type,
            effective_drift,
            tier_target,
          };
        });

      const overdueRaw = scored
        .filter((s) => s.effective_drift > 0)
        .sort((a, b) => b.effective_drift - a.effective_drift);
      const dueRaw = scored
        .filter((s) => s.effective_drift <= 0 && s.effective_drift >= -1)
        .sort((a, b) => b.effective_drift - a.effective_drift);
      const upRaw = scored
        .filter((s) => s.effective_drift < -1 && s.effective_drift >= -3)
        .sort((a, b) => b.effective_drift - a.effective_drift);

      const toCall = (s: ScoredContact, t: CallTier) => ({
        contact_id: s.contact_id,
        name: s.full_name || "Unnamed",
        last: lastLabel(s),
        suggest: suggestForCall(s, t),
        tier: t,
      });

      return {
        calls: {
          overdue: overdueRaw.slice(0, 5).map((s) => toCall(s, "overdue")),
          due: dueRaw.slice(0, 5).map((s) => toCall(s, "due")),
          up: upRaw.slice(0, 5).map((s) => toCall(s, "up")),
        },
        raw: scored,
      };
    },
  });
}

type CallsLaneCache = { calls: Calls; raw: ScoredContact[] };

function removeContactFromCallsCache(
  prev: CallsLaneCache | undefined,
  contact_id: string,
): CallsLaneCache | undefined {
  if (!prev) return prev;
  const drop = (arr: Call[]) => arr.filter((c) => c.contact_id !== contact_id);
  return {
    calls: {
      overdue: drop(prev.calls.overdue),
      due: drop(prev.calls.due),
      up: drop(prev.calls.up),
    },
    raw: prev.raw.filter((s) => s.contact_id !== contact_id),
  };
}

export function useLogCallTouch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contact_id }: { contact_id: string }) => {
      const res = await logCallTouch({ contact_id });
      if (!res.ok) throw new Error(res.error);
    },
    onMutate: async ({ contact_id }) => {
      await queryClient.cancelQueries({ queryKey: ["calls-lane"] });
      const prev = queryClient.getQueryData<CallsLaneCache>(["calls-lane"]);
      queryClient.setQueryData<CallsLaneCache>(
        ["calls-lane"],
        removeContactFromCallsCache(prev, contact_id),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["calls-lane"], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["calls-lane"] });
      queryClient.invalidateQueries({ queryKey: ["statusbar-stats"] });
      queryClient.invalidateQueries({ queryKey: ["moments"] });
    },
  });
}

export function useQueueCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contact_id }: { contact_id: string }) => {
      const res = await queueCall({ contact_id });
      if (!res.ok) throw new Error(res.error);
    },
    onMutate: async ({ contact_id }) => {
      await queryClient.cancelQueries({ queryKey: ["calls-lane"] });
      const prev = queryClient.getQueryData<CallsLaneCache>(["calls-lane"]);
      queryClient.setQueryData<CallsLaneCache>(
        ["calls-lane"],
        removeContactFromCallsCache(prev, contact_id),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["calls-lane"], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["calls-lane"] });
      queryClient.invalidateQueries({ queryKey: ["statusbar-stats"] });
    },
  });
}

// ----- Runway --------------------------------------------------------------
//
// Backed by priority_runway_items (user-owned, ordered by `position`).
// Click-to-complete writes completed_at via useToggleRunwayItem; the existing
// real-time email_drafts hook stays in useStatusBarStats because StatusBar
// still tracks open drafts.

type RunwayRow = {
  id: string;
  position: number;
  title: string;
  context: Record<string, unknown> | null;
  completed_at: string | null;
};

type RunwayContext = {
  who?: string;
  kind?: RunwayItem["kind"];
  priority?: 0 | 1 | 2 | 3;
  action?: string;
  tone?: "gold" | "crimson";
  href?: string;
};

function rowToRunwayItem(r: RunwayRow): RunwayItem {
  const ctx = (r.context ?? {}) as RunwayContext;
  const kind: RunwayItem["kind"] = ctx.kind ?? "tier-a";
  const tone: RunwayItem["tone"] = ctx.tone ?? "gold";
  const priority: 0 | 1 | 2 | 3 = (ctx.priority ?? 1) as 0 | 1 | 2 | 3;
  return {
    id: r.id,
    who: ctx.who ?? "",
    kind,
    what: r.title,
    priority,
    action: ctx.action ?? "Open",
    tone,
    href: ctx.href,
    completed_at: r.completed_at,
  };
}

export function useRunway() {
  const supabase = useMemo(() => createClient(), []);
  return useQuery<RunwayItem[]>({
    queryKey: ["runway"],
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("priority_runway_items")
        .select("id, position, title, context, completed_at")
        .is("deleted_at", null)
        .order("position", { ascending: true })
        .limit(10);
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as RunwayRow[]).map(rowToRunwayItem);
    },
  });
}

export function useToggleRunwayItem() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("priority_runway_items")
        .update({ completed_at: done ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runway"] });
    },
  });
}

export function useResetRunway() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("priority_runway_items")
        .update({ completed_at: null })
        .eq("user_id", user.id)
        .not("completed_at", "is", null);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runway"] });
    },
  });
}

// ----- Runway authoring (Phase 010) ----------------------------------------

export type RunwayDraft = {
  title: string;
  who?: string;
  kind?: RunwayItem["kind"];
  priority?: 0 | 1 | 2 | 3;
  tone?: "gold" | "crimson";
  action?: string;
  href?: string;
};

function draftToContext(draft: RunwayDraft): RunwayContext {
  const ctx: RunwayContext = {};
  if (draft.who !== undefined) ctx.who = draft.who;
  if (draft.kind !== undefined) ctx.kind = draft.kind;
  if (draft.priority !== undefined) ctx.priority = draft.priority;
  if (draft.tone !== undefined) ctx.tone = draft.tone;
  if (draft.action !== undefined) ctx.action = draft.action;
  if (draft.href !== undefined) ctx.href = draft.href;
  return ctx;
}

export function useAddRunwayItem() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: RunwayDraft) => {
      const title = draft.title.trim();
      if (!title) throw new Error("Title required");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: maxRow, error: maxErr } = await supabase
        .from("priority_runway_items")
        .select("position")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxErr) throw new Error(maxErr.message);
      const nextPos = ((maxRow?.position as number | undefined) ?? -1) + 1;

      const { error } = await supabase.from("priority_runway_items").insert({
        user_id: user.id,
        position: nextPos,
        title,
        context: draftToContext(draft),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runway"] });
    },
  });
}

export function useUpdateRunwayItem() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { title?: string; context?: RunwayContext };
    }) => {
      const update: Record<string, unknown> = {};
      if (patch.title !== undefined) update.title = patch.title.trim();
      if (patch.context !== undefined) update.context = patch.context;
      if (Object.keys(update).length === 0) return;
      const { error } = await supabase
        .from("priority_runway_items")
        .update(update)
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ["runway"] });
      const prev = queryClient.getQueryData<RunwayItem[]>(["runway"]);
      if (prev) {
        queryClient.setQueryData<RunwayItem[]>(
          ["runway"],
          prev.map((item) => {
            if (item.id !== id) return item;
            const ctx = patch.context ?? {};
            return {
              ...item,
              what: patch.title !== undefined ? patch.title : item.what,
              who: ctx.who !== undefined ? ctx.who : item.who,
              kind: ctx.kind !== undefined ? ctx.kind : item.kind,
              priority:
                ctx.priority !== undefined ? ctx.priority : item.priority,
              tone: ctx.tone !== undefined ? ctx.tone : item.tone,
              action: ctx.action !== undefined ? ctx.action : item.action,
              href: ctx.href !== undefined ? ctx.href : item.href,
            };
          }),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["runway"], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["runway"] });
    },
  });
}

export function useSoftDeleteRunwayItem() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from("priority_runway_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["runway"] });
      const prev = queryClient.getQueryData<RunwayItem[]>(["runway"]);
      if (prev) {
        queryClient.setQueryData<RunwayItem[]>(
          ["runway"],
          prev.filter((item) => item.id !== id),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["runway"], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["runway"] });
    },
  });
}

export function useReorderRunwayItems() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderedIds }: { orderedIds: string[] }) => {
      // Sequential updates wrapped in a single invalidate. Small N (<=10).
      // No RPC -- keeps the plan additive and avoids a migration.
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase
          .from("priority_runway_items")
          .update({ position: i })
          .eq("id", orderedIds[i]);
        if (error) throw new Error(error.message);
      }
    },
    onMutate: async ({ orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: ["runway"] });
      const prev = queryClient.getQueryData<RunwayItem[]>(["runway"]);
      if (prev) {
        const byId = new Map(prev.map((it) => [it.id ?? "", it]));
        const reordered = orderedIds
          .map((id) => byId.get(id))
          .filter((it): it is RunwayItem => !!it);
        queryClient.setQueryData<RunwayItem[]>(["runway"], reordered);
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["runway"], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["runway"] });
    },
  });
}

// ----- Listings ------------------------------------------------------------
//
// Backed by projects + listing_activity_checklist (left join). Replaces the
// project_touchpoints heuristic that previously mapped touchpoint_type ->
// checkbox slot. No-checklist-row means all four flags false; we do not
// auto-create on read.

const LISTING_ITEMS = ["Flyer", "Social post", "Email mention", "Personal note"];
const LISTING_FLAGS: ListingChecklistFlag[] = [
  "flyer_done",
  "social_done",
  "email_done",
  "note_done",
];

type ListingProjectRow = {
  id: string;
  title: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  owner: { full_name: string | null; tier: string | null } | null;
};

type ChecklistRow = {
  listing_id: string;
  flyer_done: boolean;
  social_done: boolean;
  email_done: boolean;
  note_done: boolean;
};

export function useListings() {
  const supabase = useMemo(() => createClient(), []);
  return useQuery<Listing[]>({
    queryKey: ["listings"],
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data: projects, error: projErr } = await supabase
        .from("projects")
        .select(
          `id, title, created_at, metadata,
           owner:contacts!owner_contact_id (full_name, tier)`,
        )
        .eq("type", "listing")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (projErr) throw new Error(projErr.message);
      const rows = (projects ?? []) as unknown as ListingProjectRow[];
      if (rows.length === 0) return [];

      // Tier filter: A or B owners only.
      const filtered = rows.filter(
        (r) => r.owner?.tier === "A" || r.owner?.tier === "B",
      );
      if (filtered.length === 0) return [];

      const ids = filtered.map((r) => r.id);
      const { data: checklistRaw, error: clErr } = await supabase
        .from("listing_activity_checklist")
        .select("listing_id, flyer_done, social_done, email_done, note_done")
        .in("listing_id", ids)
        .is("deleted_at", null);
      if (clErr) throw new Error(clErr.message);
      const checklist = (checklistRaw ?? []) as unknown as ChecklistRow[];

      const byListing = new Map<string, ChecklistRow>();
      for (const c of checklist) byListing.set(c.listing_id, c);

      const now = Date.now();
      return filtered.map((r) => {
        const cl = byListing.get(r.id);
        const tier: Listing["tier"] = r.owner?.tier === "B" ? "B" : "A";
        const days = Math.max(
          0,
          Math.floor((now - new Date(r.created_at).getTime()) / 86_400_000),
        );
        const done: boolean[] = cl
          ? [cl.flyer_done, cl.social_done, cl.email_done, cl.note_done]
          : [false, false, false, false];
        const addrFromMeta =
          typeof r.metadata?.address === "string"
            ? (r.metadata.address as string)
            : null;
        return {
          listing_id: r.id,
          agent: r.owner?.full_name ?? "Unassigned",
          tier,
          addr: addrFromMeta ?? r.title,
          days,
          items: LISTING_ITEMS,
          done,
        };
      });
    },
  });
}

export function useToggleListingChecklist() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      listing_id,
      idx,
      next,
    }: {
      listing_id: string;
      idx: number;
      next: boolean;
    }) => {
      const flag = LISTING_FLAGS[idx];
      if (!flag) throw new Error(`Invalid checklist index ${idx}`);
      const { error } = await supabase
        .from("listing_activity_checklist")
        .upsert(
          { listing_id, [flag]: next },
          { onConflict: "listing_id" },
        );
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ listing_id, idx, next }) => {
      await queryClient.cancelQueries({ queryKey: ["listings"] });
      const prev = queryClient.getQueryData<Listing[]>(["listings"]);
      if (prev) {
        queryClient.setQueryData<Listing[]>(
          ["listings"],
          prev.map((l) =>
            l.listing_id === listing_id
              ? {
                  ...l,
                  done: l.done.map((d, i) => (i === idx ? next : d)),
                }
              : l,
          ),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["listings"], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}

// ----- Moments -------------------------------------------------------------

type ActivityRow = {
  id: string;
  verb: string;
  object_table: string;
  object_id: string;
  context: Record<string, unknown> | null;
  occurred_at: string;
};

const MOMENT_DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Phoenix",
});

function momentKindFor(verb: string): Moment["kind"] {
  if (verb === "interaction.call") return "C";
  if (
    verb === "interaction.text" ||
    verb === "interaction.email" ||
    verb === "interaction.email_sent" ||
    verb === "interaction.email_received"
  )
    return "E";
  if (
    verb === "interaction.meeting" ||
    verb === "interaction.lunch" ||
    verb === "interaction.broker_open"
  )
    return "M";
  return "N";
}

function momentMetaFor(verb: string): string {
  const tail = verb.split(".")[1] ?? "note";
  return tail
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function useMoments() {
  const supabase = useMemo(() => createClient(), []);
  return useQuery<Moment[]>({
    queryKey: ["moments"],
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data: events, error: evErr } = await supabase
        .from("activity_events")
        .select("id, verb, object_table, object_id, context, occurred_at")
        .like("verb", "interaction.%")
        .is("deleted_at", null)
        .order("occurred_at", { ascending: false })
        .limit(8);
      if (evErr) throw new Error(evErr.message);
      const rows = (events ?? []) as unknown as ActivityRow[];
      if (rows.length === 0) return [];

      const contactIds = new Set<string>();
      for (const e of rows) {
        if (e.object_table === "contacts") {
          contactIds.add(e.object_id);
        } else if (typeof e.context?.contact_id === "string") {
          contactIds.add(e.context.contact_id as string);
        }
      }

      let nameById = new Map<string, string>();
      if (contactIds.size > 0) {
        const { data: contacts, error: cErr } = await supabase
          .from("contacts")
          .select("id, full_name")
          .in("id", Array.from(contactIds));
        if (cErr) throw new Error(cErr.message);
        nameById = new Map(
          (contacts ?? []).map((c) => [
            c.id as string,
            ((c.full_name as string | null) ?? "").trim(),
          ]),
        );
      }

      return rows.map((e) => {
        const cid =
          e.object_table === "contacts"
            ? e.object_id
            : typeof e.context?.contact_id === "string"
              ? (e.context.contact_id as string)
              : null;
        const who = cid ? nameById.get(cid) ?? "Unknown" : "System";
        const summary =
          (typeof e.context?.summary === "string" && e.context.summary) ||
          (typeof e.context?.subject === "string" && e.context.subject) ||
          momentMetaFor(e.verb);
        return {
          kind: momentKindFor(e.verb),
          what: summary as string,
          meta: momentMetaFor(e.verb),
          who,
          when: MOMENT_DATE_FMT.format(new Date(e.occurred_at)),
        };
      });
    },
  });
}

// ----- StatusBar stats -----------------------------------------------------

function yesterdayPhoenixWindow(): { start: string; end: string } {
  // Phoenix is UTC-7 (no DST). Yesterday window in Phoenix wall-clock,
  // serialized to ISO so PostgREST gets a fixed timestamptz range.
  const now = new Date();
  const phx = new Date(now.getTime() - 7 * 60 * 60 * 1000);
  const y = new Date(phx.getFullYear(), phx.getMonth(), phx.getDate() - 1);
  // y is in local clock; rewind back to UTC by adding 7h.
  const startUtc = new Date(
    Date.UTC(y.getFullYear(), y.getMonth(), y.getDate(), 7, 0, 0),
  );
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { start: startUtc.toISOString(), end: endUtc.toISOString() };
}

function yesterdayDateString(): string {
  const now = new Date();
  const phx = new Date(now.getTime() - 7 * 60 * 60 * 1000);
  const y = new Date(phx.getFullYear(), phx.getMonth(), phx.getDate() - 1);
  const yyyy = y.getFullYear();
  const mm = String(y.getMonth() + 1).padStart(2, "0");
  const dd = String(y.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function useStatusBarStats() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let mounted = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
      const topic = `today_v2_statusbar_${Math.random().toString(36).slice(2)}`;
      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "email_drafts" },
          () => {
            queryClient.invalidateQueries({ queryKey: ["statusbar-stats"] });
          },
        )
        .subscribe();
    })();
    return () => {
      mounted = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  return useQuery<StatusBarStats>({
    queryKey: ["statusbar-stats"],
    staleTime: STALE_MS,
    queryFn: async () => {
      const { start, end } = yesterdayPhoenixWindow();
      const yDate = yesterdayDateString();
      const nowIso = new Date().toISOString();

      const [callsRes, closedRes, listingsRes, draftsRes] = await Promise.all([
        supabase
          .from("activity_events")
          .select("id", { count: "exact", head: true })
          .eq("verb", "interaction.call")
          .is("deleted_at", null)
          .gte("occurred_at", start)
          .lt("occurred_at", end),
        supabase
          .from("opportunities")
          .select("id", { count: "exact", head: true })
          .eq("actual_close_date", yDate)
          .is("deleted_at", null),
        supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("type", "listing")
          .is("deleted_at", null)
          .gte("created_at", start)
          .lt("created_at", end),
        supabase
          .from("email_drafts")
          .select("id", { count: "exact", head: true })
          .in("status", ["generated", "approved", "revised"])
          .gt("expires_at", nowIso),
      ]);
      if (callsRes.error) throw new Error(callsRes.error.message);
      if (closedRes.error) throw new Error(closedRes.error.message);
      if (listingsRes.error) throw new Error(listingsRes.error.message);
      if (draftsRes.error) throw new Error(draftsRes.error.message);

      // Reuse calls-lane scoring output if present (no second pass).
      const callsCache = queryClient.getQueryData<{ raw: ScoredContact[] }>([
        "calls-lane",
      ]);
      const coldTierA = callsCache?.raw
        ? callsCache.raw.filter((s) => s.tier === "A" && s.effective_drift > 0)
            .length
        : 0;

      return {
        yestCalls: callsRes.count ?? 0,
        filesClosed: closedRes.count ?? 0,
        newListings: listingsRes.count ?? 0,
        openActions: draftsRes.count ?? 0,
        coldTierA,
      };
    },
  });
}
