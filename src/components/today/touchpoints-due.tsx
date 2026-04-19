"use client";

// Phase 1.3.1 Phase 8 -- TouchpointsDue card for Today view.
// Surfaces project_touchpoints rows with occurred_at IS NULL whose parent
// project is still active. These represent work that was scheduled/attached
// to a project but has not actually happened yet. RLS gates alex.
//
// Query shape uses the PostgREST relationship syntax to inner-join projects
// (`!inner` filters out touchpoints whose parent was deleted or closed).

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { AccentRule } from "@/components/screen/accent-rule";
import { Eyebrow } from "@/components/screen/eyebrow";

interface TouchpointRow {
  id: string;
  project_id: string;
  touchpoint_type: "email" | "event" | "voice_memo" | "contact_note";
  entity_table: string;
  entity_id: string;
  note: string | null;
  created_at: string;
  project: {
    id: string;
    title: string;
    status: "active";
    type: "agent_bd" | "home_tour" | "happy_hour" | "campaign" | "listing" | "other";
  } | null;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Phoenix",
});

function typeLabel(type: TouchpointRow["touchpoint_type"]): string {
  switch (type) {
    case "email":
      return "Email";
    case "event":
      return "Event";
    case "voice_memo":
      return "Voice memo";
    default:
      return "Note";
  }
}

export function TouchpointsDue() {
  const supabase = useMemo(() => createClient(), []);

  const { data, isLoading, error } = useQuery<TouchpointRow[]>({
    queryKey: ["touchpoints-due"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_touchpoints")
        .select(
          `id, project_id, touchpoint_type, entity_table, entity_id, note, created_at,
           project:projects!inner (id, title, status, type, deleted_at)`,
        )
        .is("occurred_at", null)
        .eq("project.status", "active")
        .is("project.deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as TouchpointRow[];
    },
    staleTime: 30 * 1000,
  });

  return (
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>Scheduled</Eyebrow>
          <h2 className="mt-1 font-display text-2xl tracking-tight">Touchpoints due</h2>
        </div>
      </div>

      <AccentRule className="my-4" />

      {isLoading ? (
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="font-mono text-xs uppercase tracking-wider text-destructive">
          {error instanceof Error ? error.message : "Failed to load touchpoints"}
        </p>
      ) : !data || data.length === 0 ? (
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Nothing waiting to happen
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((tp) => (
            <li key={tp.id} className="flex items-baseline gap-4">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                {typeLabel(tp.touchpoint_type)}
              </span>
              <Link href={`/projects/${tp.project_id}`} className="flex-1 group">
                <span className="font-sans text-sm font-medium group-hover:underline">
                  {tp.project?.title ?? "Untitled project"}
                </span>
                {tp.note ? (
                  <span className="ml-2 font-sans text-xs text-muted-foreground">
                    · {tp.note}
                  </span>
                ) : null}
                <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  · added {DATE_FORMATTER.format(new Date(tp.created_at))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
