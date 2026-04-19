"use client";

// Phase 1.3.1 Phase 8 -- DraftsPending card for Today view.
// Queries email_drafts directly (RLS gates alex), 30s stale, Supabase Realtime
// subscription on email_drafts INSERT/UPDATE/DELETE invalidates the query so new
// drafts appear live without a refresh. Co-exists with InboxSummaryCard; that
// card counts inbox_items (pending replies), this one counts Claude-generated
// drafts awaiting approval.

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { AccentRule } from "@/components/screen/accent-rule";
import { Eyebrow } from "@/components/screen/eyebrow";

interface DraftRow {
  id: string;
  draft_subject: string | null;
  status: "generated" | "approved" | "revised";
  escalation_flag: string | null;
  generated_at: string;
  expires_at: string;
  email:
    | {
        from_name: string | null;
        from_email: string | null;
        subject: string | null;
      }
    | null;
}

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Phoenix",
});

function formatCountdown(expiresIso: string): string {
  const diffMs = new Date(expiresIso).getTime() - Date.now();
  if (diffMs <= 0) return "expired";
  const mins = Math.floor(diffMs / 60_000);
  return `${mins}m left`;
}

function escalationLabel(flag: string | null): { text: string; tone: "warning" | "info" } | null {
  if (flag === "marlene") return { text: "Escalate to Marlene", tone: "warning" };
  if (flag === "agent_followup") return { text: "Agent follow-up", tone: "info" };
  return null;
}

export function DraftsPending() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const nowIso = useMemo(() => new Date().toISOString(), []);

  const { data, isLoading, error } = useQuery<DraftRow[]>({
    queryKey: ["drafts-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_drafts")
        .select(
          `id, draft_subject, status, escalation_flag, generated_at, expires_at,
           email:emails!inner (from_name, from_email, subject)`,
        )
        .in("status", ["generated", "approved", "revised"])
        .gt("expires_at", nowIso)
        .order("generated_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as DraftRow[];
    },
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    // Await session before subscribing so Realtime authenticates with alex's JWT,
    // otherwise RLS (auth.jwt() ->> 'email' = alex@...) filters every postgres_changes
    // event as anon. Unique topic per mount dodges StrictMode double-mount collisions.
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
      const topic = `drafts_pending_${Math.random().toString(36).slice(2)}`;
      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "email_drafts" },
          () => {
            queryClient.invalidateQueries({ queryKey: ["drafts-pending"] });
          },
        )
        .subscribe();
    })();
    return () => {
      mounted = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  return (
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>Draft queue</Eyebrow>
          <h2 className="mt-1 font-display text-2xl tracking-tight">Pending drafts</h2>
        </div>
        <Link
          href="/drafts"
          className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Open queue
        </Link>
      </div>

      <AccentRule className="my-4" />

      {isLoading ? (
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="font-mono text-xs uppercase tracking-wider text-destructive">
          {error instanceof Error ? error.message : "Failed to load drafts"}
        </p>
      ) : !data || data.length === 0 ? (
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          No pending drafts
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((draft) => {
            const esc = escalationLabel(draft.escalation_flag);
            const sender = draft.email?.from_name ?? draft.email?.from_email ?? "unknown sender";
            const subject = draft.draft_subject ?? draft.email?.subject ?? "(no subject)";
            return (
              <li key={draft.id} className="flex items-baseline gap-4">
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  {TIME_FORMATTER.format(new Date(draft.generated_at))}
                </span>
                <Link
                  href={`/drafts?draft=${draft.id}`}
                  className="flex-1 group"
                >
                  <span className="font-sans text-sm font-medium group-hover:underline">
                    {subject}
                  </span>
                  <span className="ml-2 font-sans text-xs text-muted-foreground">
                    · {sender}
                  </span>
                  {esc ? (
                    <span
                      className={`ml-2 font-mono text-[10px] uppercase tracking-wider ${
                        esc.tone === "warning" ? "text-amber-500" : "text-sky-400"
                      }`}
                    >
                      · {esc.text}
                    </span>
                  ) : null}
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    · {formatCountdown(draft.expires_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
