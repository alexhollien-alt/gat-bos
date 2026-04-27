"use client";

// today-v2 live queries. Five hooks back the prototype shells with live
// Supabase reads. Read-only; mutations land in Phase 3.
//
// Realtime: only email_drafts subscribes (Phase 9 dev fix pattern --
// getSession -> setAuth -> subscribe, unique topic per mount). Projects /
// touchpoints / activity_events ride the 30s staleTime; not latency-critical.

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  Calls,
  CallTier,
  Listing,
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

// ----- Runway --------------------------------------------------------------

type DraftRow = {
  id: string;
  draft_subject: string | null;
  status: "generated" | "approved" | "revised";
  escalation_flag: string | null;
  expires_at: string;
  email: { from_name: string | null; from_email: string | null } | null;
};

type TouchpointRow = {
  id: string;
  project_id: string;
  touchpoint_type: "email" | "event" | "voice_memo" | "contact_note";
  occurred_at: string | null;
  project: { id: string; title: string; status: string; deleted_at: string | null } | null;
};

export function useRunway() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const nowIso = useMemo(() => new Date().toISOString(), []);

  const query = useQuery<RunwayItem[]>({
    queryKey: ["runway"],
    staleTime: STALE_MS,
    queryFn: async () => {
      const [draftsRes, tpRes] = await Promise.all([
        supabase
          .from("email_drafts")
          .select(
            `id, draft_subject, status, escalation_flag, expires_at,
             email:emails!inner (from_name, from_email)`,
          )
          .in("status", ["generated", "approved", "revised"])
          .gt("expires_at", nowIso)
          .order("generated_at", { ascending: false })
          .limit(20),
        supabase
          .from("project_touchpoints")
          .select(
            `id, project_id, touchpoint_type, occurred_at,
             project:projects!inner (id, title, status, deleted_at)`,
          )
          .is("occurred_at", null)
          .limit(50),
      ]);
      if (draftsRes.error) throw new Error(draftsRes.error.message);
      if (tpRes.error) throw new Error(tpRes.error.message);

      const items: RunwayItem[] = [];

      for (const d of (draftsRes.data ?? []) as unknown as DraftRow[]) {
        const escalated = !!d.escalation_flag;
        const sender =
          d.email?.from_name ?? d.email?.from_email ?? "unknown sender";
        items.push({
          who: sender,
          kind: "draft",
          what: d.draft_subject ?? "Draft awaiting approval",
          priority: escalated ? 3 : 2,
          action: "Approve",
          tone: escalated ? "crimson" : "gold",
          href: `/drafts?draft=${d.id}`,
        });
      }

      for (const t of (tpRes.data ?? []) as unknown as TouchpointRow[]) {
        const proj = t.project;
        if (!proj || proj.status !== "active" || proj.deleted_at !== null) continue;
        items.push({
          who: proj.title,
          kind: "touchpoint",
          what: `Open touchpoint: ${t.touchpoint_type.replace("_", " ")}`,
          priority: 1,
          action: "Open",
          tone: "gold",
          href: `/projects/${proj.id}`,
        });
      }

      const order: Record<RunwayItem["kind"], number> = {
        system: 0,
        touchpoint: 1,
        draft: 2,
        "tier-a": 3,
      };
      items.sort((a, b) => {
        const tonePri = (i: RunwayItem) => (i.tone === "crimson" ? 1 : 0);
        const k = order[a.kind] - order[b.kind];
        if (k !== 0) return k;
        return tonePri(a) - tonePri(b);
      });

      return items.slice(0, 10);
    },
  });

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
      const topic = `today_v2_runway_${Math.random().toString(36).slice(2)}`;
      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "email_drafts" },
          () => {
            queryClient.invalidateQueries({ queryKey: ["runway"] });
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

  return query;
}

// ----- Listings ------------------------------------------------------------

const LISTING_ITEMS = ["Flyer", "Social post", "Email mention", "Personal note"];

type ListingProjectRow = {
  id: string;
  title: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  owner: { full_name: string | null; tier: string | null } | null;
};

type RollupRow = {
  project_id: string;
  touchpoint_type: "email" | "event" | "voice_memo" | "contact_note";
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

      const ids = rows.map((r) => r.id);
      const { data: rollupRaw, error: tpErr } = await supabase
        .from("project_touchpoints")
        .select("project_id, touchpoint_type")
        .in("project_id", ids)
        .not("occurred_at", "is", null);
      if (tpErr) throw new Error(tpErr.message);
      const rollup = (rollupRaw ?? []) as unknown as RollupRow[];

      const seen = new Map<string, Set<RollupRow["touchpoint_type"]>>();
      for (const r of rollup) {
        const set = seen.get(r.project_id) ?? new Set();
        set.add(r.touchpoint_type);
        seen.set(r.project_id, set);
      }

      const now = Date.now();
      return rows.map((r) => {
        const tp = seen.get(r.id) ?? new Set<RollupRow["touchpoint_type"]>();
        const tier: Listing["tier"] =
          r.owner?.tier === "B" ? "B" : "A";
        const days = Math.max(
          0,
          Math.floor((now - new Date(r.created_at).getTime()) / 86_400_000),
        );
        // Heuristic mapping (plan risk: log to BLOCKERS.md if wrong):
        //   Flyer            -> contact_note proxy (no ticket entity yet)
        //   Social post      -> event
        //   Email mention    -> email
        //   Personal note    -> voice_memo
        const done: boolean[] = [
          tp.has("contact_note"),
          tp.has("event"),
          tp.has("email"),
          tp.has("voice_memo"),
        ];
        const addrFromMeta =
          typeof r.metadata?.address === "string"
            ? (r.metadata.address as string)
            : null;
        return {
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
