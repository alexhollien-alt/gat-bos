"use client";

// Phase 1.3.1 Phase 5 -- /drafts approval dashboard client.
// Left rail = pending drafts list with escalation badges + 30-min countdown.
// Right rail = side-by-side original vs draft, 4 action buttons, revise textarea.
// Live updates via TanStack useQuery (30s stale) + Supabase Realtime channel
// on email_drafts INSERT / UPDATE that invalidates the query.

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  AccentRule,
  Eyebrow,
  PageHeader,
  SectionShell,
} from "@/components/screen";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { AttachToProject } from "@/components/drafts/attach-to-project";
import { toast } from "sonner";
import {
  AlertTriangle,
  Briefcase,
  Clock,
  Inbox,
  Mail,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { ALEX_EMAIL } from "@/lib/constants";

export interface EmailRow {
  id: string;
  gmail_id: string;
  gmail_thread_id: string | null;
  from_email: string;
  from_name: string | null;
  subject: string;
  body_plain: string | null;
  body_html: string | null;
  snippet: string | null;
  created_at: string;
  is_unread: boolean;
  is_contact_match: boolean;
  contact_id: string | null;
  contact_domain: string | null;
  is_potential_re_pro: boolean;
}

export interface DraftRow {
  id: string;
  email_id: string;
  draft_subject: string | null;
  draft_body_plain: string | null;
  draft_body_html: string | null;
  status: "generated" | "approved" | "revised" | "sent" | "discarded";
  escalation_flag: "marlene" | "agent_followup" | null;
  escalation_reason: string | null;
  generated_at: string;
  expires_at: string;
  sent_at: string | null;
  sent_via: "resend" | "gmail_draft" | null;
  revisions_count: number;
  audit_log: { event_sequence?: Array<Record<string, unknown>> } | null;
  email: EmailRow;
}

type Action = "send_now" | "create_gmail_draft" | "discard" | "revise";

async function fetchDrafts(): Promise<DraftRow[]> {
  const res = await fetch("/api/email/drafts", { cache: "no-store" });
  if (!res.ok) throw new Error(`failed to load drafts: ${res.status}`);
  const json = (await res.json()) as { drafts?: DraftRow[] };
  return json.drafts ?? [];
}

async function postAction(payload: {
  draft_id: string;
  action: Action;
  revised_body?: string;
  revised_subject?: string;
}) {
  const res = await fetch("/api/email/approve-and-send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((json.error as string) ?? `request failed (${res.status})`);
  }
  return json;
}

function useCountdown(targetIso: string) {
  const target = useMemo(() => new Date(targetIso).getTime(), [targetIso]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remainingMs = Math.max(0, target - now);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    remainingMs,
    expired: remainingMs === 0,
    label: `${minutes}:${seconds.toString().padStart(2, "0")}`,
  };
}

// Escalation badge colors pull from globals.css Kit Screen tokens.
// --status-warning (#eab308 amber) for Marlene escrow surfacing.
// --status-info (#3b82f6 sky) for BD prospect surfacing.
// Badges use outline variant + bordered foreground tint so the alert reads
// without the heavy fill of the destructive variant.
type EscalationTone = "warning" | "info";
const ESCALATION_BADGE_CLASS: Record<EscalationTone, string> = {
  warning:
    "border-[var(--status-warning)] text-[var(--status-warning)] bg-[var(--status-warning)]/10",
  info: "border-[var(--status-info)] text-[var(--status-info)] bg-[var(--status-info)]/10",
};

function escalationLabel(flag: DraftRow["escalation_flag"]) {
  if (flag === "marlene") return { text: "Marlene escrow", tone: "warning" as const };
  if (flag === "agent_followup") return { text: "BD prospect", tone: "info" as const };
  return null;
}

export function DraftsClient() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revising, setRevising] = useState(false);
  const [revisedBody, setRevisedBody] = useState("");
  const [revisedSubject, setRevisedSubject] = useState("");

  const { data: drafts = [], isLoading } = useQuery<DraftRow[]>({
    queryKey: ["email_drafts", "pending"],
    queryFn: fetchDrafts,
    staleTime: 30 * 1000,
  });

  // Realtime subscription -- invalidate on any email_drafts mutation.
  useEffect(() => {
    const channel = supabase
      .channel("email_drafts_dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_drafts" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["email_drafts", "pending"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  // Pick first draft when list loads or selection becomes invalid.
  useEffect(() => {
    if (drafts.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !drafts.find((d) => d.id === selectedId)) {
      setSelectedId(drafts[0].id);
    }
  }, [drafts, selectedId]);

  const selected = drafts.find((d) => d.id === selectedId) ?? null;

  // Reset revise UI on selection change.
  useEffect(() => {
    setRevising(false);
    setRevisedBody(selected?.draft_body_plain ?? "");
    setRevisedSubject(selected?.draft_subject ?? "");
  }, [selectedId, selected?.draft_body_plain, selected?.draft_subject]);

  const mutation = useMutation({
    mutationFn: postAction,
    onSuccess: (_data, vars) => {
      const labels: Record<Action, string> = {
        send_now: "Email sent",
        create_gmail_draft: "Gmail draft created",
        discard: "Draft discarded",
        revise: "Draft revised, 30-min timer reset",
      };
      toast.success(labels[vars.action]);
      queryClient.invalidateQueries({ queryKey: ["email_drafts", "pending"] });
      if (vars.action !== "revise") setRevising(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Action failed";
      toast.error(message);
    },
  });

  const handleAction = (action: Action) => {
    if (!selected) return;
    if (action === "revise") {
      if (!revising) {
        setRevising(true);
        setRevisedBody(selected.draft_body_plain ?? "");
        setRevisedSubject(selected.draft_subject ?? "");
        return;
      }
      mutation.mutate({
        draft_id: selected.id,
        action,
        revised_body: revisedBody,
        revised_subject: revisedSubject,
      });
      return;
    }
    mutation.mutate({ draft_id: selected.id, action });
  };

  return (
    <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0">
      <PageHeader
        eyebrow="Inbox triage"
        title="Drafts"
        subhead={
          <span className="font-mono tracking-wide text-[12px]">
            {drafts.length} pending {drafts.length === 1 ? "draft" : "drafts"}
            {" "}-- signed in as {ALEX_EMAIL}
          </span>
        }
      />
      <AccentRule variant="hairline" className="mt-4 mb-6" />

      <div className="grid grid-cols-12 gap-6 min-h-[70vh]">
        <aside className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-2">
          <Eyebrow tone="muted">Pending</Eyebrow>
          {isLoading && drafts.length === 0 ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : drafts.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              <Inbox className="h-4 w-4 mb-2" />
              No pending drafts. New emails sync hourly.
            </div>
          ) : (
            drafts.map((d) => (
              <DraftListItem
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
            <DraftDetail
              draft={selected}
              revising={revising}
              revisedBody={revisedBody}
              revisedSubject={revisedSubject}
              onRevisedBody={setRevisedBody}
              onRevisedSubject={setRevisedSubject}
              onCancelRevise={() => setRevising(false)}
              onAction={handleAction}
              busy={mutation.isPending}
            />
          ) : (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Select a draft to review.
              </p>
            </div>
          )}
        </section>
      </div>
    </SectionShell>
  );
}

function DraftListItem({
  draft,
  active,
  onClick,
}: {
  draft: DraftRow;
  active: boolean;
  onClick: () => void;
}) {
  const escalation = escalationLabel(draft.escalation_flag);
  const countdown = useCountdown(draft.expires_at);
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
            {draft.email.from_name || draft.email.from_email}
          </p>
          <p className="text-[12px] text-muted-foreground truncate">
            {draft.email.subject}
          </p>
        </div>
        {countdown.expired ? (
          <Badge variant="destructive" className="font-mono text-[10px] shrink-0">
            EXPIRED
          </Badge>
        ) : (
          <span className="font-mono text-[11px] text-muted-foreground shrink-0 inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {countdown.label}
          </span>
        )}
      </div>
      {escalation ? (
        <div className="mt-2">
          <Badge
            variant="outline"
            className={`text-[10px] ${ESCALATION_BADGE_CLASS[escalation.tone]}`}
          >
            {escalation.tone === "warning" ? (
              <AlertTriangle className="h-3 w-3 mr-1" />
            ) : (
              <Briefcase className="h-3 w-3 mr-1" />
            )}
            {escalation.text}
          </Badge>
        </div>
      ) : null}
      {draft.status === "revised" ? (
        <p className="mt-1 text-[11px] font-mono text-muted-foreground">
          revised x{draft.revisions_count}
        </p>
      ) : null}
    </button>
  );
}

function DraftDetail({
  draft,
  revising,
  revisedBody,
  revisedSubject,
  onRevisedBody,
  onRevisedSubject,
  onCancelRevise,
  onAction,
  busy,
}: {
  draft: DraftRow;
  revising: boolean;
  revisedBody: string;
  revisedSubject: string;
  onRevisedBody: (v: string) => void;
  onRevisedSubject: (v: string) => void;
  onCancelRevise: () => void;
  onAction: (action: Action) => void;
  busy: boolean;
}) {
  const countdown = useCountdown(draft.expires_at);
  const escalation = escalationLabel(draft.escalation_flag);
  const sendDisabled = busy || countdown.expired;

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Eyebrow tone="muted">Original</Eyebrow>
            <h2 className="font-display text-h2-screen leading-tight">
              {draft.email.subject}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              From{" "}
              <span className="text-foreground">
                {draft.email.from_name || draft.email.from_email}
              </span>
              {draft.email.from_name ? (
                <span className="font-mono"> ({draft.email.from_email})</span>
              ) : null}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
              received {new Date(draft.email.created_at).toLocaleString()}
            </p>
          </div>
          <div className="text-right shrink-0">
            {countdown.expired ? (
              <Badge variant="destructive" className="font-mono text-[10px]">
                EXPIRED
              </Badge>
            ) : (
              <span className="font-mono text-sm text-foreground inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {countdown.label} left
              </span>
            )}
            {escalation ? (
              <div className="mt-1">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${ESCALATION_BADGE_CLASS[escalation.tone]}`}
                >
                  {escalation.text}
                </Badge>
              </div>
            ) : null}
          </div>
        </div>
        {draft.escalation_reason ? (
          <p className="text-[12px] font-mono text-muted-foreground">
            Reason: {draft.escalation_reason}
          </p>
        ) : null}
      </header>

      <Separator />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <article className="rounded-lg border border-border bg-card p-4">
          <Eyebrow tone="muted">Their email</Eyebrow>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-foreground">
            {draft.email.body_plain ?? draft.email.snippet ?? ""}
          </pre>
        </article>

        <article className="rounded-lg border border-foreground/30 bg-card p-4">
          <div className="flex items-center justify-between">
            <Eyebrow tone="muted">Your draft</Eyebrow>
            <span className="font-mono text-[11px] text-muted-foreground">
              {draft.status} {draft.revisions_count > 0 ? `· rev ${draft.revisions_count}` : ""}
            </span>
          </div>
          {revising ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={revisedSubject}
                onChange={(e) => onRevisedSubject(e.target.value)}
                placeholder="Subject"
                className="font-display text-base"
                rows={1}
              />
              <Textarea
                value={revisedBody}
                onChange={(e) => onRevisedBody(e.target.value)}
                rows={14}
                className="font-sans text-sm"
              />
            </div>
          ) : (
            <>
              <p className="font-display text-base mt-2">
                {draft.draft_subject || `Re: ${draft.email.subject}`}
              </p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-foreground">
                {draft.draft_body_plain ?? ""}
              </pre>
            </>
          )}
        </article>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => onAction("send_now")}
          disabled={sendDisabled || revising}
          className="bg-[var(--accent-red)] hover:bg-[var(--accent-red-hover)]"
        >
          <Send className="h-4 w-4 mr-2" />
          Send Now
        </Button>
        <Button
          variant="secondary"
          onClick={() => onAction("create_gmail_draft")}
          disabled={sendDisabled || revising}
        >
          <Mail className="h-4 w-4 mr-2" />
          Create Gmail Draft
        </Button>
        {revising ? (
          <>
            <Button onClick={() => onAction("revise")} disabled={busy}>
              <Pencil className="h-4 w-4 mr-2" />
              Save revision
            </Button>
            <Button variant="ghost" onClick={onCancelRevise} disabled={busy}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => onAction("revise")} disabled={busy}>
            <Pencil className="h-4 w-4 mr-2" />
            Revise
          </Button>
        )}
        <AttachToProject draftId={draft.id} disabled={busy || revising} />
        <Button
          variant="ghost"
          onClick={() => onAction("discard")}
          disabled={busy}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Discard
        </Button>
      </div>

      {draft.audit_log?.event_sequence?.length ? (
        <details className="rounded-lg border border-border bg-card p-3 text-[12px]">
          <summary className="cursor-pointer font-mono text-muted-foreground">
            Audit log ({draft.audit_log.event_sequence.length} events)
          </summary>
          <ol className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
            {draft.audit_log.event_sequence.map((evt, i) => (
              <li key={i}>
                {String(evt.timestamp ?? "")} -- {String(evt.event ?? "")}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
