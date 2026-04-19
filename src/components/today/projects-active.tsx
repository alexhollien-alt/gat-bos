"use client";

// Phase 1.3.1 Phase 8 -- ProjectsActive card for Today view.
// Queries projects where status='active' AND deleted_at IS NULL. RLS gates
// alex via the alex_projects_all policy. 30s stale; relies on stale-time
// tolerance rather than realtime (Phase 8 decision: realtime only on drafts).

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { AccentRule } from "@/components/screen/accent-rule";
import { Eyebrow } from "@/components/screen/eyebrow";

interface ProjectRow {
  id: string;
  type: "agent_bd" | "home_tour" | "happy_hour" | "campaign" | "listing" | "other";
  title: string;
  status: "active";
  updated_at: string;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Phoenix",
});

function typeLabel(type: ProjectRow["type"]): string {
  switch (type) {
    case "agent_bd":
      return "Agent BD";
    case "home_tour":
      return "Home tour";
    case "happy_hour":
      return "Happy hour";
    case "campaign":
      return "Campaign";
    case "listing":
      return "Listing";
    default:
      return "Other";
  }
}

export function ProjectsActive() {
  const supabase = useMemo(() => createClient(), []);

  const { data, isLoading, error } = useQuery<ProjectRow[]>({
    queryKey: ["projects-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, type, title, status, updated_at")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return (data ?? []) as ProjectRow[];
    },
    staleTime: 30 * 1000,
  });

  return (
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>In flight</Eyebrow>
          <h2 className="mt-1 font-display text-2xl tracking-tight">Active projects</h2>
        </div>
        <Link
          href="/projects"
          className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          All projects
        </Link>
      </div>

      <AccentRule className="my-4" />

      {isLoading ? (
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="font-mono text-xs uppercase tracking-wider text-destructive">
          {error instanceof Error ? error.message : "Failed to load projects"}
        </p>
      ) : !data || data.length === 0 ? (
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          No active projects
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((project) => (
            <li key={project.id} className="flex items-baseline gap-4">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                {typeLabel(project.type)}
              </span>
              <Link href={`/projects/${project.id}`} className="flex-1 group">
                <span className="font-sans text-sm font-medium group-hover:underline">
                  {project.title}
                </span>
                <span className="ml-2 font-sans text-xs text-muted-foreground">
                  · updated {DATE_FORMATTER.format(new Date(project.updated_at))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
