"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  PROJECT_TYPE_LABELS,
  type Project,
} from "@/lib/types";

interface AttachToProjectProps {
  draftId: string;
  disabled?: boolean;
}

export function AttachToProject({ draftId, disabled }: AttachToProjectProps) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("projects")
      .select("*")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(25)
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          toast.error("Failed to load projects");
          return;
        }
        setProjects((data ?? []) as Project[]);
      });
  }, [open, supabase]);

  async function attach(projectId: string) {
    setAttaching(projectId);
    const { error } = await supabase.from("project_touchpoints").insert({
      project_id: projectId,
      touchpoint_type: "email",
      entity_id: draftId,
      entity_table: "email_drafts",
      occurred_at: new Date().toISOString(),
    });
    setAttaching(null);
    if (error) {
      toast.error(`Failed to attach: ${error.message}`);
      return;
    }
    toast.success("Attached to project");
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Link2 className="h-4 w-4 mr-2" />
          Attach to project
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          Active projects
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
        ) : projects.length === 0 ? (
          <DropdownMenuItem disabled>No active projects</DropdownMenuItem>
        ) : (
          projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onSelect={(e) => {
                e.preventDefault();
                attach(project.id);
              }}
              disabled={attaching !== null}
              className="flex items-start gap-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{project.title}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {PROJECT_TYPE_LABELS[project.type]}
                </p>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
