"use client";

// Client hooks for the 3-tab dashboard. Reads via useQuery (keys match the
// server prefetch in page.tsx so hydration is seamless). The three writes are
// optimistic: onMutate snapshots + patches the cache, onError rolls back,
// onSettled recomputes from the authoritative server read. Pattern mirrors
// today-v2/queries.ts useLogCallTouch.

import { useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { TemperatureRow } from "@/lib/scoring/temperature";
import {
  addTask,
  getScoredContacts,
  logTouch,
  toggleTask,
  undoLogTouch,
} from "./actions";
import {
  fetchCounters,
  fetchOpenTasks,
  fetchProspects,
  fetchWeekly,
  type Counters,
  type OpenTask,
} from "./_data";

export const KEY = {
  scored: ["dashboard", "v3", "scored"] as const,
  tasks: ["dashboard", "v3", "tasks", "open"] as const,
  counters: ["dashboard", "v3", "counters"] as const,
  prospects: ["dashboard", "v3", "prospects"] as const,
  weekly: ["dashboard", "v3", "weekly"] as const,
};

const TOAST_MS = 5000;
let tempCounter = 0;

// ----- Reads ---------------------------------------------------------------

export function useScored() {
  return useQuery<TemperatureRow[]>({
    queryKey: KEY.scored,
    queryFn: () => getScoredContacts(),
    staleTime: 60_000,
  });
}

export function useOpenTasks() {
  const supabase = useMemo(() => createClient(), []);
  return useQuery<OpenTask[]>({
    queryKey: KEY.tasks,
    queryFn: () => fetchOpenTasks(supabase),
    staleTime: 30_000,
  });
}

export function useCounters() {
  const supabase = useMemo(() => createClient(), []);
  return useQuery<Counters>({
    queryKey: KEY.counters,
    queryFn: () => fetchCounters(supabase),
    staleTime: 30_000,
  });
}

export function useProspects(enabled: boolean) {
  const supabase = useMemo(() => createClient(), []);
  return useQuery({
    queryKey: KEY.prospects,
    queryFn: () => fetchProspects(supabase),
    staleTime: 60_000,
    enabled,
  });
}

export function useWeekly(enabled: boolean) {
  const supabase = useMemo(() => createClient(), []);
  return useQuery({
    queryKey: KEY.weekly,
    queryFn: () => fetchWeekly(supabase),
    staleTime: 60_000,
    enabled,
  });
}

// ----- Writes --------------------------------------------------------------

async function runUndoTouch(event_id: string, qc: QueryClient) {
  const res = await undoLogTouch({ event_id });
  if (!res.ok) {
    toast.error(res.error, { position: "top-right" });
    return;
  }
  qc.invalidateQueries({ queryKey: KEY.scored });
  qc.invalidateQueries({ queryKey: KEY.counters });
}

export function useLogTouch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contact_id }: { contact_id: string; name?: string }) => {
      const res = await logTouch({ contact_id });
      if (!res.ok) throw new Error(res.error);
      return { event_id: res.event_id };
    },
    onMutate: async ({ contact_id }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: KEY.scored }),
        qc.cancelQueries({ queryKey: KEY.counters }),
      ]);
      const prevScored = qc.getQueryData<TemperatureRow[]>(KEY.scored);
      const prevCounters = qc.getQueryData<Counters>(KEY.counters);
      if (prevScored) {
        qc.setQueryData<TemperatureRow[]>(
          KEY.scored,
          prevScored.filter((r) => r.contact_id !== contact_id),
        );
      }
      if (prevCounters) {
        qc.setQueryData<Counters>(KEY.counters, {
          ...prevCounters,
          touches: prevCounters.touches + 1,
        });
      }
      return { prevScored, prevCounters };
    },
    onSuccess: (data, vars) => {
      const event_id = data.event_id;
      toast.success("Touch logged", {
        description: vars.name,
        position: "top-right",
        duration: TOAST_MS,
        action: event_id
          ? { label: "Undo", onClick: () => runUndoTouch(event_id, qc) }
          : undefined,
      });
    },
    onError: (err: unknown, _vars, ctx) => {
      if (ctx?.prevScored) qc.setQueryData(KEY.scored, ctx.prevScored);
      if (ctx?.prevCounters) qc.setQueryData(KEY.counters, ctx.prevCounters);
      toast.error(err instanceof Error ? err.message : "Couldn't log touch", {
        position: "top-right",
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY.scored });
      qc.invalidateQueries({ queryKey: KEY.counters });
    },
  });
}

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      task_id,
      completed,
    }: {
      task_id: string;
      completed: boolean;
    }) => {
      const res = await toggleTask({ task_id, completed });
      if (!res.ok) throw new Error(res.error);
    },
    onMutate: async ({ task_id, completed }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: KEY.tasks }),
        qc.cancelQueries({ queryKey: KEY.counters }),
      ]);
      const prevTasks = qc.getQueryData<OpenTask[]>(KEY.tasks);
      const prevCounters = qc.getQueryData<Counters>(KEY.counters);
      if (prevTasks && completed) {
        qc.setQueryData<OpenTask[]>(
          KEY.tasks,
          prevTasks.filter((t) => t.id !== task_id),
        );
      }
      if (prevCounters) {
        qc.setQueryData<Counters>(KEY.counters, {
          ...prevCounters,
          tasksDone: prevCounters.tasksDone + (completed ? 1 : -1),
        });
      }
      return { prevTasks, prevCounters };
    },
    onError: (err: unknown, _vars, ctx) => {
      if (ctx?.prevTasks) qc.setQueryData(KEY.tasks, ctx.prevTasks);
      if (ctx?.prevCounters) qc.setQueryData(KEY.counters, ctx.prevCounters);
      toast.error(err instanceof Error ? err.message : "Couldn't update task", {
        position: "top-right",
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY.tasks });
      qc.invalidateQueries({ queryKey: KEY.counters });
    },
  });
}

export function useAddTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ title }: { title: string }) => {
      const res = await addTask({ title });
      if (!res.ok) throw new Error(res.error);
      return { id: res.id as string };
    },
    onMutate: async ({ title }) => {
      await qc.cancelQueries({ queryKey: KEY.tasks });
      const prevTasks = qc.getQueryData<OpenTask[]>(KEY.tasks);
      const tempId = `temp-${tempCounter++}`;
      const optimistic: OpenTask = {
        id: tempId,
        title: title.trim(),
        status: "open",
        due_date: null,
        completed_at: null,
        contact_id: null,
      };
      qc.setQueryData<OpenTask[]>(KEY.tasks, [...(prevTasks ?? []), optimistic]);
      return { prevTasks, tempId };
    },
    onSuccess: (data, _vars, ctx) => {
      // Reconcile the temp id to the real id (no row-replace flash).
      qc.setQueryData<OpenTask[]>(KEY.tasks, (cur) =>
        (cur ?? []).map((t) =>
          t.id === ctx?.tempId ? { ...t, id: data.id } : t,
        ),
      );
    },
    onError: (err: unknown, _vars, ctx) => {
      if (ctx?.prevTasks) qc.setQueryData(KEY.tasks, ctx.prevTasks);
      toast.error(err instanceof Error ? err.message : "Couldn't add task", {
        position: "top-right",
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY.tasks });
    },
  });
}
