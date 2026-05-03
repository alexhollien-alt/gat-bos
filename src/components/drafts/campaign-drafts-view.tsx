"use client";

// Slice 8 Phase 4 -- Campaign tab inside the unified /drafts surface.
// Lists campaign_drafts, renders the rendered HTML inline via PreviewFrame,
// and exposes Approve / Reject / Edit actions against /api/campaigns/drafts.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Eyebrow } from "@/components/screen";
import { PreviewFrame } from "@/app/(app)/weekly-edge/preview/preview-frame";
import { toast } from "sonner";
import { CheckCircle2, FileText, Pencil, X } from "lucide-react";

export interface CampaignDraftRow {
  id: string;
  template_slug: string;
  template_version: number | null;
  week_of: string;
  recipient_list_slug: string;
  subject: string;
  body_html: string;
  body_text: string;
  status: "pending_review" | "approved" | "rejected" | "sent" | "send_failed";
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  sent_at: string | null;
  send_summary: {
    sent?: number;
    failed?: number;
    total?: number;
    errors?: Array<{ recipient: string; error?: string }>;
  } | null;
  narrative_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

async function fetchCampaignDrafts(): Promise<CampaignDraftRow[]> {
  const res = await fetch("/api/campaigns/drafts", { cache: "no-store" });
  if (!res.ok) throw new Error(`failed to load campaign drafts: ${res.status}`);
  const json = (await res.json()) as { drafts?: CampaignDraftRow[] };
  return json.drafts ?? [];
}

async function patchCampaignDraft(payload: {
  id: string;
  action: "approve" | "reject" | "edit_html";
  body_html?: string;
  rejected_reason?: string;
}) {
  const res = await fetch("/api/campaigns/drafts", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((json.error as string) ?? `request failed (${res.status})`);
  return json;
}

const STATUS_LABEL: Record<CampaignDraftRow["status"], string> = {
  pending_review: "PENDING REVIEW",
  approved: "APPROVED",
  rejected: "REJECTED",
  sent: "SENT",
  send_failed: "SEND FAILED",
};

const STATUS_TONE: Record<CampaignDraftRow["status"], string> = {
  pending_review: "border-[var(--status-info)] text-[var(--status-info)] bg-[var(--status-info)]/10",
  approved: "border-[var(--status-success)] text-[var(--status-success)] bg-[var(--status-success)]/10",
  rejected: "border-[var(--status-warning)] text-[var(--status-warning)] bg-[var(--status-warning)]/10",
  sent: "border-foreground/30 text-foreground bg-secondary",
  send_failed: "border-destructive text-destructive bg-destructive/10",
};

export function CampaignDraftsView() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedHtml, setEditedHtml] = useState("");

  const { data: drafts = [], isLoading } = useQuery<CampaignDraftRow[]>({
    queryKey: ["campaign_drafts", "all"],
    queryFn: fetchCampaignDrafts,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (drafts.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !drafts.find((d) => d.id === selectedId)) {
      setSelectedId(drafts[0].id);
    }
  }, [drafts, selectedId]);

  const selected = useMemo(
    () => drafts.find((d) => d.id === selectedId) ?? null,
    [drafts, selectedId],
  );

  useEffect(() => {
    setEditing(false);
    setEditedHtml(selected?.body_html ?? "");
  }, [selectedId, selected?.body_html]);

  const mutation = useMutation({
    mutationFn: patchCampaignDraft,
    onSuccess: (_data, vars) => {
      const labels: Record<string, string> = {
        approve: "Campaign approved -- queued for next send window",
        reject: "Campaign rejected",
        edit_html: "Campaign HTML updated",
      };
      toast.success(labels[vars.action] ?? "Updated");
      queryClient.invalidateQueries({ queryKey: ["campaign_drafts", "all"] });
      if (vars.action !== "edit_html") setEditing(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Action failed";
      toast.error(message);
    },
  });

  return (
    <div className="grid grid-cols-12 gap-6 min-h-[70vh]">
      <aside className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-2">
        <Eyebrow tone="muted">Campaign drafts</Eyebrow>
        {isLoading && drafts.length === 0 ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : drafts.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            <FileText className="h-4 w-4 mb-2" />
            No campaign drafts. The Tuesday 11 AM PHX assembly cron writes the next one.
          </div>
        ) : (
          drafts.map((d) => (
            <CampaignListItem
              key={d.id}
              draft={d}
              active={d.id === selectedId}
              onClick={() => setSelectedId(d.id)}
            />
          ))
        )}
      </aside>

      <section className="col-span-12 lg:col-span-8 xl:col-span-9">
        {selected ? (
          <CampaignDetail
            draft={selected}
            editing={editing}
            editedHtml={editedHtml}
            onEditedHtml={setEditedHtml}
            onStartEdit={() => {
              setEditedHtml(selected.body_html);
              setEditing(true);
            }}
            onCancelEdit={() => setEditing(false)}
            onSaveEdit={() =>
              mutation.mutate({
                id: selected.id,
                action: "edit_html",
                body_html: editedHtml,
              })
            }
            onApprove={() => mutation.mutate({ id: selected.id, action: "approve" })}
            onReject={() => mutation.mutate({ id: selected.id, action: "reject" })}
            busy={mutation.isPending}
          />
        ) : (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Select a campaign draft to review.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function CampaignListItem({
  draft,
  active,
  onClick,
}: {
  draft: CampaignDraftRow;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left rounded-lg border p-3 transition-colors",
        active
          ? "border-foreground/30 bg-secondary"
          : "border-border bg-card hover:border-foreground/20",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-sm leading-tight truncate">
            Week of {draft.week_of}
          </p>
          <p className="text-[12px] text-muted-foreground truncate">
            {draft.template_slug} -- {draft.recipient_list_slug}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] shrink-0 ${STATUS_TONE[draft.status]}`}
        >
          {STATUS_LABEL[draft.status]}
        </Badge>
      </div>
      {draft.send_summary?.total !== undefined ? (
        <p className="mt-1 text-[11px] font-mono text-muted-foreground">
          {draft.send_summary.sent ?? 0}/{draft.send_summary.total} sent
          {draft.send_summary.failed ? ` -- ${draft.send_summary.failed} failed` : ""}
        </p>
      ) : null}
    </button>
  );
}

function CampaignDetail({
  draft,
  editing,
  editedHtml,
  onEditedHtml,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onApprove,
  onReject,
  busy,
}: {
  draft: CampaignDraftRow;
  editing: boolean;
  editedHtml: string;
  onEditedHtml: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const reviewable = draft.status === "pending_review";
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-base">{draft.subject}</p>
            <p className="text-[12px] text-muted-foreground font-mono">
              week_of {draft.week_of} -- template {draft.template_slug} v
              {draft.template_version ?? "?"} -- list {draft.recipient_list_slug}
            </p>
          </div>
          <Badge
            variant="outline"
            className={`text-[11px] shrink-0 ${STATUS_TONE[draft.status]}`}
          >
            {STATUS_LABEL[draft.status]}
          </Badge>
        </div>
        {draft.rejected_reason ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Rejected reason: {draft.rejected_reason}
          </p>
        ) : null}
        {draft.send_summary?.errors && draft.send_summary.errors.length > 0 ? (
          <div className="mt-3 text-xs text-destructive">
            <p className="font-medium mb-1">Send errors:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {draft.send_summary.errors.slice(0, 5).map((e, i) => (
                <li key={i}>
                  {e.recipient}: {e.error ?? "unknown"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={editedHtml}
            onChange={(e) => onEditedHtml(e.target.value)}
            className="min-h-[480px] font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button onClick={onSaveEdit} disabled={busy} size="sm">
              Save HTML
            </Button>
            <Button onClick={onCancelEdit} variant="outline" size="sm">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <PreviewFrame html={draft.body_html} />
      )}

      {reviewable && !editing ? (
        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={onApprove} disabled={busy} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Approve
          </Button>
          <Button onClick={onStartEdit} disabled={busy} variant="outline" className="gap-2">
            <Pencil className="h-4 w-4" />
            Edit HTML
          </Button>
          <Button onClick={onReject} disabled={busy} variant="outline" className="gap-2">
            <X className="h-4 w-4" />
            Reject
          </Button>
        </div>
      ) : null}
    </div>
  );
}
