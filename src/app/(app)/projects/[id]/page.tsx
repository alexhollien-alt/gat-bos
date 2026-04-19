"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  PROJECT_TYPE_LABELS,
  type Project,
  type ProjectStatus,
  type ProjectTouchpoint,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/screen";
import { toast } from "sonner";

type LoadState = "loading" | "loaded" | "not_found" | "error";

const STATUS_TONE: Record<ProjectStatus, string> = {
  active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  paused: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  closed: "text-muted-foreground bg-muted/30 border-border",
};

const TOUCHPOINT_LABEL: Record<string, string> = {
  email: "Email",
  event: "Event",
  voice_memo: "Voice Memo",
  contact_note: "Note",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = typeof rawId === "string" ? rawId : "";
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [touchpoints, setTouchpoints] = useState<ProjectTouchpoint[]>([]);
  const [ownerName, setOwnerName] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setLoadState("not_found");
      return;
    }
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("Failed to load project:", error);
      setLoadState("error");
      return;
    }
    if (!data) {
      setLoadState("not_found");
      return;
    }
    setProject(data as Project);
    setLoadState("loaded");

    if (data.owner_contact_id) {
      const { data: owner } = await supabase
        .from("contacts")
        .select("first_name, last_name")
        .eq("id", data.owner_contact_id)
        .maybeSingle();
      if (owner) {
        setOwnerName(`${owner.first_name} ${owner.last_name}`);
      }
    }
  }, [projectId, supabase]);

  const fetchTouchpoints = useCallback(async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from("project_touchpoints")
      .select("*")
      .eq("project_id", projectId)
      .order("occurred_at", { ascending: false, nullsFirst: false });
    setTouchpoints((data ?? []) as ProjectTouchpoint[]);
  }, [projectId, supabase]);

  useEffect(() => {
    fetchProject();
    fetchTouchpoints();
  }, [fetchProject, fetchTouchpoints]);

  async function updateStatus(next: ProjectStatus) {
    if (!project) return;
    const { error } = await supabase
      .from("projects")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", project.id);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    setProject({ ...project, status: next });
    toast.success("Status updated");
  }

  if (loadState === "loading") {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (loadState === "not_found" || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <p className="text-muted-foreground">Project not found.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/today">Back to today</Link>
        </Button>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <p className="text-muted-foreground">
          Something went wrong loading this project.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoadState("loading");
            fetchProject();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl pb-12">
      <section className="relative mb-6 overflow-hidden rounded-xl border border-border bg-secondary/20 p-6 sm:p-8">
        <PageHeader
          size="lg"
          eyebrow={PROJECT_TYPE_LABELS[project.type]}
          title={project.title}
          subhead={
            ownerName ? (
              <span>
                Owner:{" "}
                <Link
                  href={`/contacts/${project.owner_contact_id}`}
                  className="text-foreground hover:underline"
                >
                  {ownerName}
                </Link>
              </span>
            ) : undefined
          }
          right={
            <div className="flex flex-col items-end gap-3">
              <span
                className={`inline-flex items-center rounded border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.15em] ${STATUS_TONE[project.status]}`}
              >
                {project.status}
              </span>
              <div className="flex gap-2">
                {(["active", "paused", "closed"] as ProjectStatus[])
                  .filter((s) => s !== project.status)
                  .map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatus(s)}
                      className="h-7 px-2 text-xs capitalize"
                    >
                      {s}
                    </Button>
                  ))}
              </div>
            </div>
          }
        />
      </section>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-foreground">
            Touchpoints
          </h2>
          <span className="font-mono text-xs text-muted-foreground">
            {touchpoints.length} total
          </span>
        </div>

        {touchpoints.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No touchpoints yet. Attach an email draft, event, or contact note
            to this project.
          </p>
        ) : (
          <div className="space-y-2">
            {touchpoints.map((tp) => (
              <div
                key={tp.id}
                className="rounded-md border border-border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {TOUCHPOINT_LABEL[tp.touchpoint_type] ??
                        tp.touchpoint_type}
                    </p>
                    {tp.note && (
                      <p className="mt-1 text-sm text-foreground">{tp.note}</p>
                    )}
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {tp.entity_table}:{tp.entity_id.slice(0, 8)}
                    </p>
                  </div>
                  {tp.occurred_at && (
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {new Date(tp.occurred_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
