"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  PROJECT_TYPE_LABELS,
  type Project,
  type ProjectStatus,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const STATUS_TONE: Record<ProjectStatus, string> = {
  active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  paused: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  closed: "text-muted-foreground bg-muted/30 border-border",
};

interface ContactProjectsPanelProps {
  contactId: string;
}

export function ContactProjectsPanel({ contactId }: ContactProjectsPanelProps) {
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);

    const { data: owned } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_contact_id", contactId)
      .is("deleted_at", null);

    const { data: touchpoints } = await supabase
      .from("project_touchpoints")
      .select("project_id")
      .eq("entity_table", "contacts")
      .eq("entity_id", contactId);

    const linkedIds = Array.from(
      new Set((touchpoints ?? []).map((t) => t.project_id as string))
    );

    let linked: Project[] = [];
    if (linkedIds.length > 0) {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .in("id", linkedIds)
        .is("deleted_at", null);
      linked = (data ?? []) as Project[];
    }

    const seen = new Set<string>();
    const merged: Project[] = [];
    for (const p of [...((owned ?? []) as Project[]), ...linked]) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        merged.push(p);
      }
    }
    merged.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    setProjects(merged);
    setLoading(false);
  }, [contactId, supabase]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function quickCreate() {
    if (creating) return;
    setCreating(true);
    const { error } = await supabase.from("projects").insert({
      type: "other",
      title: "Untitled project",
      status: "active",
      owner_contact_id: contactId,
    });
    setCreating(false);
    if (error) {
      toast.error("Failed to create project");
      return;
    }
    toast.success("Project created");
    fetchProjects();
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Loading projects...
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {projects.length === 0
            ? "No projects attached yet"
            : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={quickCreate}
          disabled={creating}
          className="h-7 px-2 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          New project
        </Button>
      </div>

      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          className="block rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-secondary/50"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {project.title}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {PROJECT_TYPE_LABELS[project.type]}
              </p>
            </div>
            <span
              className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${STATUS_TONE[project.status]}`}
            >
              {project.status}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
