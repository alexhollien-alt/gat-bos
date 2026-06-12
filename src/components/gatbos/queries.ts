"use client";

// GAT-BOS redesign live queries. View-models match the prototype's data shapes
// (.prototype/new-face-gat-bos/project/data.jsx); every hook reads existing
// tables through the proven today-v2 pattern (Supabase reads in queryFn,
// 30s staleTime, RLS scopes rows). Derive-first: no new schema.

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { toggleTask } from "./actions";
import type { WarmthKey } from "./ui";
import {
  daysSince,
  deriveWarmth,
  dueLabel,
  fullName,
  journeyStage,
  priorityRank,
  relativeLabel,
  tierValue,
} from "./derive";

const STALE_MS = 30_000;

// ---------- view models ----------

export type PersonVM = {
  id: string;
  name: string;
  company: string;
  role: string;
  stage: string; // journey label
  warmth: WarmthKey;
  value: "high" | "medium" | "low";
  lastTouch: string;
  nextTouch: string;
  touches: number;
  opportunity: string;
  project: string;
  comms: string;
  events: string;
  escrowOfficer: string;
  partners: string;
  nextBest: string;
  note: string;
};

export type TaskVM = {
  id: string;
  title: string;
  projectId: string | null;
  projectName: string | null;
  personId: string | null;
  personName: string | null;
  column: "Today" | "Next" | "Waiting" | "Completed";
  priority: number; // 1-4
  due: string; // label
  dueIso: string | null;
  overdue: boolean;
  dueToday: boolean;
  waiting: string | null;
  why: string | null;
  next: string | null;
  done: boolean;
};

export type ProjectVM = {
  id: string;
  name: string;
  type: string;
  personName: string | null;
  progress: number;
  due: string;
  status: string;
  open: number;
  total: number;
};

export type CaptureVM = { id: string; text: string; when: string };

export type MeetingVM = { id: string; title: string; when: string; personName: string | null; where: string };

export type MaterialVM = {
  id: string;
  title: string;
  personName: string | null;
  type: string;
  bucket: string;
  followup: string;
  due: string;
};

export type CampaignVM = {
  id: string;
  name: string;
  personName: string | null;
  touch: string;
  channel: string;
  status: string;
  next: string;
  result: string;
  pct: number;
};

// ---------- shared helpers ----------

const PROJECT_TYPE_LABEL: Record<string, string> = {
  agent_bd: "Agent BD",
  home_tour: "Home Tour",
  happy_hour: "Event",
  campaign: "Campaign",
  listing: "Listing",
  other: "Project",
};

const PROJECT_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  closed: "Closed",
};

const MATERIAL_BUCKET: Record<string, string> = {
  draft: "Requested",
  submitted: "Requested",
  in_production: "In Design",
  complete: "Produced & Delivered",
};

const MATERIAL_TYPE_LABEL: Record<string, string> = {
  print_ready: "Print Ready",
  design_help: "Design",
  template_request: "Template",
};

const ASSET_TYPE_LABEL: Record<string, string> = {
  flyer: "Flyer",
  brochure: "Brochure",
  door_hanger: "Door Hanger",
  eddm: "EDDM",
  postcard: "Postcard",
  social: "Social",
  presentation: "Presentation",
  other: "Asset",
};

// Light id -> display-name map, RLS-scoped. Avoids .in(id-list) GET filters
// that overflow the query string with hundreds of UUIDs.
async function contactNameMap(supabase: ReturnType<typeof createClient>): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, full_name")
    .is("deleted_at", null)
    .limit(1000);
  const names = new Map<string, string>();
  for (const c of data ?? []) {
    names.set(
      c.id as string,
      fullName(c as { full_name: string | null; first_name: string; last_name: string })
    );
  }
  return names;
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayIso(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

// ---------- People ----------

export function useGatbosPeople() {
  const supabase = useMemo(() => createClient(), []);
  return useQuery<PersonVM[]>({
    queryKey: ["gatbos", "people"],
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data: contacts, error } = await supabase
        .from("contacts")
        .select(
          "id, first_name, last_name, full_name, brokerage, title, type, stage, tier, health_score, rep_pulse, last_touchpoint, next_action, next_followup, preferred_channel, escrow_officer, notes, internal_note"
        )
        .is("deleted_at", null)
        .limit(500);
      if (error) throw new Error(error.message);
      const rows = contacts ?? [];
      if (rows.length === 0) return [];

      // RLS scopes every table to the signed-in user; no .in(id-list) filters
      // (500 UUIDs in a GET query string breaks the request).
      const [interactionsRes, projectsRes, oppsRes] = await Promise.all([
        supabase
          .from("interactions")
          .select("contact_id, occurred_at")
          .order("occurred_at", { ascending: false })
          .limit(5000),
        supabase
          .from("projects")
          .select("owner_contact_id, title, status")
          .is("deleted_at", null)
          .limit(500),
        supabase
          .from("opportunities")
          .select("contact_id, property_address, stage")
          .in("stage", ["prospect", "under_contract", "in_escrow"])
          .is("deleted_at", null)
          .limit(500),
      ]);
      if (interactionsRes.error) throw new Error(interactionsRes.error.message);

      const latest = new Map<string, string>();
      const counts = new Map<string, number>();
      for (const i of interactionsRes.data ?? []) {
        const id = i.contact_id as string;
        counts.set(id, (counts.get(id) ?? 0) + 1);
        if (!latest.has(id) && i.occurred_at) latest.set(id, i.occurred_at as string);
      }
      const projByContact = new Map<string, string>();
      for (const p of projectsRes.data ?? []) {
        const id = p.owner_contact_id as string | null;
        if (id && p.status === "active" && !projByContact.has(id)) projByContact.set(id, p.title as string);
      }
      const oppByContact = new Map<string, string>();
      for (const o of oppsRes.data ?? []) {
        const id = o.contact_id as string;
        if (!oppByContact.has(id)) {
          const label =
            o.stage === "in_escrow" || o.stage === "under_contract"
              ? `Escrow in motion · ${o.property_address ?? "address TBD"}`
              : `Prospect · ${o.property_address ?? "new opportunity"}`;
          oppByContact.set(id, label);
        }
      }

      return rows.map((c) => {
        const days = daysSince(latest.get(c.id as string) ?? (c.last_touchpoint as string | null));
        const warmth = deriveWarmth({
          stage: c.stage as string,
          healthScore: c.health_score as number | null,
          repPulse: c.rep_pulse as number | null,
          days,
          tier: c.tier as string | null,
        });
        const name = fullName(c as { full_name: string | null; first_name: string; last_name: string });
        return {
          id: c.id as string,
          name,
          company: (c.brokerage as string | null) ?? "Independent",
          role: (c.title as string | null) ?? prettyType(c.type as string),
          stage: journeyStage(c.stage as string, warmth),
          warmth,
          value: tierValue(c.tier as string | null),
          lastTouch: relativeLabel(days),
          nextTouch: (c.next_followup as string | null) ?? "Not set",
          touches: counts.get(c.id as string) ?? 0,
          opportunity: oppByContact.get(c.id as string) ?? "No open opportunity on file",
          project: projByContact.get(c.id as string) ?? "--",
          comms: (c.preferred_channel as string | null) ?? "--",
          events: "--",
          escrowOfficer: (c.escrow_officer as string | null) ?? "--",
          partners: "--",
          nextBest: (c.next_action as string | null) ?? defaultNextBest(warmth, name),
          note: (c.internal_note as string | null) ?? (c.notes as string | null) ?? "",
        } satisfies PersonVM;
      });
    },
  });
}

function prettyType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function defaultNextBest(warmth: WarmthKey, name: string): string {
  switch (warmth) {
    case "hot":
      return "Strike while warm: book the next touch this week";
    case "warm":
      return "Keep cadence: send a useful, no-ask note";
    case "needs":
      return `Send ${name.split(" ")[0]} a quick market snapshot`;
    case "cooling":
      return "Re-open with a personal invite or check-in";
    case "atrisk":
      return "Call personally, own the gap, no pitch";
    default:
      return "Add to the quarterly newsletter list";
  }
}

// ---------- Tasks + Projects ----------

type TaskRowRaw = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  due_reason: string | null;
  action_hint: string | null;
  snoozed_until: string | null;
  contact_id: string | null;
  project_id: string | null;
  completed_at: string | null;
};

export function useGatbosTasks() {
  const supabase = useMemo(() => createClient(), []);
  return useQuery<{ tasks: TaskVM[]; projects: ProjectVM[] }>({
    queryKey: ["gatbos", "tasks"],
    staleTime: STALE_MS,
    queryFn: async () => {
      const [tasksRes, projectsRes] = await Promise.all([
        supabase
          .from("tasks")
          .select(
            "id, title, status, priority, due_date, due_reason, action_hint, snoozed_until, contact_id, project_id, completed_at"
          )
          .is("deleted_at", null)
          .neq("status", "cancelled")
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(500),
        supabase
          .from("projects")
          .select("id, title, type, status, owner_contact_id, metadata")
          .is("deleted_at", null)
          .limit(200),
      ]);
      if (tasksRes.error) throw new Error(tasksRes.error.message);
      if (projectsRes.error) throw new Error(projectsRes.error.message);

      const taskRows = (tasksRes.data ?? []) as TaskRowRaw[];
      const projectRows = projectsRes.data ?? [];

      const names = await contactNameMap(supabase);
      const projectNames = new Map<string, string>(
        projectRows.map((p) => [p.id as string, p.title as string])
      );

      const eod = endOfTodayIso();
      const tasks: TaskVM[] = taskRows.map((t) => {
        const done = t.status === "done";
        const overdue = !done && !!t.due_date && new Date(t.due_date) < new Date(startOfTodayIso());
        const dueToday = !done && !!t.due_date && !overdue && new Date(t.due_date) <= new Date(eod);
        const column: TaskVM["column"] = done
          ? "Completed"
          : t.status === "snoozed"
            ? "Waiting"
            : overdue || dueToday
              ? "Today"
              : "Next";
        return {
          id: t.id,
          title: t.title,
          projectId: t.project_id,
          projectName: t.project_id ? (projectNames.get(t.project_id) ?? null) : null,
          personId: t.contact_id,
          personName: t.contact_id ? (names.get(t.contact_id) ?? null) : null,
          column,
          priority: priorityRank(t.priority),
          due: t.due_date ? dueLabel(t.due_date) : "--",
          dueIso: t.due_date,
          overdue,
          dueToday,
          waiting: t.status === "snoozed" ? `Snoozed until ${t.snoozed_until ? dueLabel(t.snoozed_until) : "later"}` : null,
          why: t.due_reason,
          next: t.action_hint,
          done,
        } satisfies TaskVM;
      });

      const projects: ProjectVM[] = projectRows.map((p) => {
        const related = tasks.filter((t) => t.projectId === (p.id as string));
        const total = related.length;
        const open = related.filter((t) => !t.done).length;
        const progress = total > 0 ? Math.round(((total - open) / total) * 100) : 0;
        const nextDue = related
          .filter((t) => !t.done && t.dueIso)
          .map((t) => t.dueIso as string)
          .sort()[0];
        return {
          id: p.id as string,
          name: p.title as string,
          type: PROJECT_TYPE_LABEL[p.type as string] ?? "Project",
          personName: p.owner_contact_id ? (names.get(p.owner_contact_id as string) ?? null) : null,
          progress,
          due: nextDue ? dueLabel(nextDue) : "--",
          status: PROJECT_STATUS_LABEL[p.status as string] ?? (p.status as string),
          open,
          total,
        } satisfies ProjectVM;
      });

      return { tasks, projects };
    },
  });
}

export function useToggleTaskDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const res = await toggleTask({ task_id: taskId, completed });
      if (!res.ok) throw new Error(res.error ?? "Could not update task");
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gatbos", "tasks"] });
      toast.success("Task updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Captures ----------

export function useGatbosCaptures() {
  const supabase = useMemo(() => createClient(), []);
  return useQuery<CaptureVM[]>({
    queryKey: ["gatbos", "captures"],
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("captures")
        .select("id, raw_text, created_at, processed")
        .eq("processed", false)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw new Error(error.message);
      return (data ?? []).map((c) => ({
        id: c.id as string,
        text: c.raw_text as string,
        when: relativeLabel(daysSince(c.created_at as string)),
      }));
    },
  });
}

export function useQuickCapture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ text }: { text: string; type: string }) => {
      // Reuse the existing captures pipeline (parse + cadence + activity log).
      const res = await fetch("/api/captures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: text, source: "manual" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Capture failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gatbos", "captures"] });
      toast.success("Captured");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Meetings (events) ----------

export function useGatbosMeetings() {
  const supabase = useMemo(() => createClient(), []);
  return useQuery<MeetingVM[]>({
    queryKey: ["gatbos", "meetings"],
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, start_at, location, location_override, contact_id")
        .is("deleted_at", null)
        .gte("start_at", startOfTodayIso())
        .order("start_at", { ascending: true })
        .limit(5);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const names = rows.some((e) => e.contact_id) ? await contactNameMap(supabase) : new Map<string, string>();
      return rows.map((e) => {
        const start = new Date(e.start_at as string);
        const sameDay = start.toDateString() === new Date().toDateString();
        const day = sameDay ? "Today" : start.toLocaleDateString("en-US", { weekday: "short" });
        const time = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        return {
          id: e.id as string,
          title: e.title as string,
          when: `${day} · ${time}`,
          personName: e.contact_id ? (names.get(e.contact_id as string) ?? null) : null,
          where: (e.location_override as string | null) ?? (e.location as string | null) ?? "TBD",
        } satisfies MeetingVM;
      });
    },
  });
}

// ---------- Materials + Campaigns ----------

export function useGatbosMaterials() {
  const supabase = useMemo(() => createClient(), []);
  return useQuery<MaterialVM[]>({
    queryKey: ["gatbos", "materials"],
    staleTime: STALE_MS,
    queryFn: async () => {
      const [reqRes, assetRes] = await Promise.all([
        supabase
          .from("material_requests")
          .select("id, title, status, request_type, notes, submitted_at, completed_at, contact_id")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("design_assets")
          .select("id, name, asset_type, contact_id, created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (reqRes.error) throw new Error(reqRes.error.message);
      if (assetRes.error) throw new Error(assetRes.error.message);

      const reqs = reqRes.data ?? [];
      const assets = assetRes.data ?? [];
      const hasContacts = [...reqs, ...assets].some((r) => r.contact_id);
      const names = hasContacts ? await contactNameMap(supabase) : new Map<string, string>();

      const fromRequests: MaterialVM[] = reqs.map((r) => ({
        id: r.id as string,
        title: r.title as string,
        personName: r.contact_id ? (names.get(r.contact_id as string) ?? null) : null,
        type: MATERIAL_TYPE_LABEL[r.request_type as string] ?? "Request",
        bucket: MATERIAL_BUCKET[r.status as string] ?? "Requested",
        followup:
          r.status === "complete"
            ? "Deliver + ask how it landed"
            : r.status === "in_production"
              ? "Send proof for approval when ready"
              : "Confirm scope + kickoff",
        due: r.completed_at ? "Done" : r.submitted_at ? relativeLabel(daysSince(r.submitted_at as string)) : "--",
      }));

      const fromAssets: MaterialVM[] = assets.map((a) => ({
        id: a.id as string,
        title: a.name as string,
        personName: a.contact_id ? (names.get(a.contact_id as string) ?? null) : null,
        type: ASSET_TYPE_LABEL[a.asset_type as string] ?? "Asset",
        bucket: "Live & Results",
        followup: "Ask how engagement looked",
        due: "Done",
      }));

      return [...fromRequests, ...fromAssets];
    },
  });
}

export function useGatbosCampaigns() {
  const supabase = useMemo(() => createClient(), []);
  return useQuery<CampaignVM[]>({
    queryKey: ["gatbos", "campaigns"],
    staleTime: STALE_MS,
    queryFn: async () => {
      const [campRes, enrollRes] = await Promise.all([
        supabase
          .from("campaigns")
          .select("id, name, type, status, step_count, enrolled_count")
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("campaign_enrollments")
          .select("campaign_id, current_step, next_action_at, status")
          .is("deleted_at", null)
          .eq("status", "active")
          .limit(2000),
      ]);
      if (campRes.error) throw new Error(campRes.error.message);
      if (enrollRes.error) throw new Error(enrollRes.error.message);

      const stepByCampaign = new Map<string, number>();
      const nextByCampaign = new Map<string, string>();
      for (const e of enrollRes.data ?? []) {
        const id = e.campaign_id as string;
        stepByCampaign.set(id, Math.max(stepByCampaign.get(id) ?? 0, (e.current_step as number) ?? 0));
        const next = e.next_action_at as string | null;
        if (next && (!nextByCampaign.has(id) || next < nextByCampaign.get(id)!)) {
          nextByCampaign.set(id, next);
        }
      }

      return (campRes.data ?? []).map((c) => {
        const total = (c.step_count as number) ?? 0;
        const cur = stepByCampaign.get(c.id as string) ?? 0;
        const next = nextByCampaign.get(c.id as string);
        return {
          id: c.id as string,
          name: c.name as string,
          personName: null,
          touch: total > 0 ? `${cur} of ${total}` : `${cur}`,
          channel: prettyType((c.type as string) || "email"),
          status: prettyType((c.status as string) || "active"),
          next: next ? `Touch ${cur + 1} · ${dueLabel(next)}` : "No touch scheduled",
          result: `${(c.enrolled_count as number) ?? 0} enrolled`,
          pct: total > 0 ? Math.min(100, Math.round((cur / total) * 100)) : 0,
        } satisfies CampaignVM;
      });
    },
  });
}
