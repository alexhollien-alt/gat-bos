"use client";

/**
 * TaskListWidget -- Tier 1 dashboard widget #1
 *
 * Replaces ActionQueueWidget. The old widget queried contacts.company and
 * contacts.relationship which do not exist in the live schema, so it was
 * silently returning broken data.
 *
 * Architecture per ~/.claude/rules/dashboard.md:
 *   - 6 Linear Focus buckets in fixed order (Section 5 of architecture doc)
 *   - TanStack Query for data fetching with bucket-specific staleTime
 *   - Supabase Realtime channel.invalidateQueries for live updates
 *   - Optimistic mutations for complete/snooze
 *   - NO client-side health_score bumps (materialized view owns the score)
 *   - Workspace tier visual: dark cards, hover transitions only, no glass/mesh
 *   - Accessibility floor: role/aria-label/aria-live, always-visible buttons,
 *     44x44 touch targets on mobile
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { addDays, format, formatDistanceToNowStrict } from "date-fns";
import {
  AlertCircle,
  Home,
  Snowflake,
  Sparkles,
  TrendingDown,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  ExternalLink,
  Target,
} from "lucide-react";

// ============================================================
// Constants
// ============================================================

const ITEMS_PER_BUCKET = 3;

// Screen palette per digital-aesthetic.md (NOT the print #b31a35/#003087)
const BUCKET_COLORS = {
  overdue_followups: "#e63550", // electric crimson
  closings: "#f97316", // orange
  going_cold: "#eab308", // yellow
  proactive: "#22c55e", // green
  stalled_pipeline: "#71717a", // gray
} as const;

// ============================================================
// Type definitions
// ============================================================

interface ContactRef {
  id: string;
  first_name: string | null;
  last_name: string | null;
  tier: "A" | "B" | "C" | "P" | null;
  phone: string | null;
  email: string | null;
}

interface FollowUpRow {
  id: string;
  reason: string;
  due_date: string;
  priority: string;
  contact_id: string;
  contacts: ContactRef | null;
}

interface ClosingRow {
  id: string;
  property_address: string;
  scheduled_close_date: string;
  stage: string;
  contact_id: string;
  contacts: ContactRef | null;
}

interface AgentHealthRow {
  contact_id: string;
  health_score: number | null;
  days_since_contact: number | null;
  trend_direction: string | null;
  contacts: ContactRef | null;
}

interface OpportunityRow {
  id: string;
  property_address: string | null;
  stage: string | null;
  opened_at: string | null;
  expected_close_date: string | null;
  contact_id: string;
  contacts: ContactRef | null;
}

// ============================================================
// Helpers
// ============================================================

function contactName(c: ContactRef | null): string {
  if (!c) return "Unknown";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function formatRelative(dateStr: string): string {
  try {
    return formatDistanceToNowStrict(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

// ============================================================
// Component
// ============================================================

export function TaskListWidget() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  // Resolve current user once on mount
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // ----------------------------------------------------------
  // Bucket 1: Overdue follow-ups (red)
  // ----------------------------------------------------------
  const followUpsQuery = useQuery({
    queryKey: ["task-list", "overdue_followups", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<FollowUpRow[]> => {
      const today = todayISO();
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("follow_ups")
        .select(
          "id, reason, due_date, priority, contact_id, contacts(id, first_name, last_name, tier, phone, email)"
        )
        .eq("user_id", userId!)
        .eq("status", "pending")
        .is("deleted_at", null)
        .or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`)
        .lte("due_date", today)
        .order("due_date", { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as FollowUpRow[];
    },
  });

  // ----------------------------------------------------------
  // Bucket 2: Closings today/tomorrow (orange)
  // ----------------------------------------------------------
  const closingsQuery = useQuery({
    queryKey: ["task-list", "closings", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<ClosingRow[]> => {
      const today = todayISO();
      const tomorrow = addDays(new Date(), 1).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("deals")
        .select(
          "id, property_address, scheduled_close_date, stage, contact_id, contacts(id, first_name, last_name, tier, phone, email)"
        )
        .eq("user_id", userId!)
        .is("deleted_at", null)
        .in("stage", ["in_escrow", "clear_to_close"])
        .gte("scheduled_close_date", today)
        .lte("scheduled_close_date", tomorrow)
        .order("scheduled_close_date", { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as ClosingRow[];
    },
  });

  // ----------------------------------------------------------
  // Bucket 3: Agents going cold (yellow)
  //   trend_direction = 'down' OR not contacted in 21+ days
  //   filtered to A/B/C tier (skip P prospects)
  // ----------------------------------------------------------
  const goingColdQuery = useQuery({
    queryKey: ["task-list", "going_cold", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<AgentHealthRow[]> => {
      const { data, error } = await supabase
        .from("agent_health")
        .select(
          "contact_id, health_score, days_since_contact, trend_direction, contacts(id, first_name, last_name, tier, phone, email)"
        )
        .eq("user_id", userId!)
        .or("trend_direction.eq.down,days_since_contact.gte.21")
        .order("days_since_contact", { ascending: false, nullsFirst: false })
        .limit(20);
      if (error) throw error;
      return ((data ?? []) as unknown as AgentHealthRow[]).filter(
        (r) => r.contacts?.tier && r.contacts.tier !== "P"
      );
    },
  });

  // ----------------------------------------------------------
  // Bucket 4: Scheduled meetings -- SKIPPED in v1 (no calendar wired yet)
  // ----------------------------------------------------------

  // ----------------------------------------------------------
  // Bucket 5: Proactive touchpoints (green)
  //   Healthy A/B-tier contacts who haven't been touched in 7-20 days
  //   (less than 21 = not "going cold" yet, more than 7 = could use a ping)
  // ----------------------------------------------------------
  const proactiveQuery = useQuery({
    queryKey: ["task-list", "proactive", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<AgentHealthRow[]> => {
      const { data, error } = await supabase
        .from("agent_health")
        .select(
          "contact_id, health_score, days_since_contact, trend_direction, contacts(id, first_name, last_name, tier, phone, email)"
        )
        .eq("user_id", userId!)
        .gte("health_score", 60)
        .gte("days_since_contact", 7)
        .lte("days_since_contact", 20)
        .order("health_score", { ascending: false })
        .limit(20);
      if (error) throw error;
      return ((data ?? []) as unknown as AgentHealthRow[]).filter(
        (r) => r.contacts?.tier === "A" || r.contacts?.tier === "B"
      );
    },
  });

  // ----------------------------------------------------------
  // Bucket 6: Pipeline items needing attention (gray)
  //   Opportunities opened more than 30 days ago, still active
  // ----------------------------------------------------------
  const pipelineQuery = useQuery({
    queryKey: ["task-list", "stalled_pipeline", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<OpportunityRow[]> => {
      const thirtyDaysAgo = addDays(new Date(), -30).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("opportunities")
        .select(
          "id, property_address, stage, opened_at, expected_close_date, contact_id, contacts(id, first_name, last_name, tier, phone, email)"
        )
        .eq("user_id", userId!)
        .is("deleted_at", null)
        .lte("opened_at", thirtyDaysAgo)
        .order("opened_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as OpportunityRow[];
    },
  });

  // ----------------------------------------------------------
  // Realtime subscriptions: invalidate the right query on table change
  // ----------------------------------------------------------
  useEffect(() => {
    if (!userId) return;

    const channels = [
      supabase
        .channel("task-list:follow_ups")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "follow_ups" },
          () => {
            queryClient.invalidateQueries({
              queryKey: ["task-list", "overdue_followups", userId],
            });
          }
        )
        .subscribe(),
      supabase
        .channel("task-list:deals")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "deals" },
          () => {
            queryClient.invalidateQueries({
              queryKey: ["task-list", "closings", userId],
            });
          }
        )
        .subscribe(),
      supabase
        .channel("task-list:interactions")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "interactions" },
          () => {
            // Interactions feed agent_health via the materialized view trigger
            queryClient.invalidateQueries({
              queryKey: ["task-list", "going_cold", userId],
            });
            queryClient.invalidateQueries({
              queryKey: ["task-list", "proactive", userId],
            });
          }
        )
        .subscribe(),
      supabase
        .channel("task-list:opportunities")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "opportunities" },
          () => {
            queryClient.invalidateQueries({
              queryKey: ["task-list", "stalled_pipeline", userId],
            });
          }
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [userId, queryClient, supabase]);

  // ----------------------------------------------------------
  // Mutations
  // ----------------------------------------------------------

  // Complete a follow-up: log an interaction + mark complete + link the two.
  // The materialized view recomputes health_score on its own via the trigger
  // on interactions. NO client-side health bump.
  const completeFollowUp = useMutation({
    mutationFn: async ({
      followUpId,
      contactId,
      reason,
      interactionType,
    }: {
      followUpId: string;
      contactId: string;
      reason: string;
      interactionType: "call" | "email";
    }) => {
      if (!userId) throw new Error("No user");
      const { data: interaction, error: intError } = await supabase
        .from("interactions")
        .insert({
          user_id: userId,
          contact_id: contactId,
          type: interactionType,
          summary: `Follow-up: ${reason}`,
          direction: "outbound",
        })
        .select("id")
        .single();
      if (intError) throw intError;

      const { error: fuError } = await supabase
        .from("follow_ups")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_via_interaction_id: interaction?.id ?? null,
        })
        .eq("id", followUpId);
      if (fuError) throw fuError;
    },
    onMutate: async ({ followUpId }) => {
      const key = ["task-list", "overdue_followups", userId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FollowUpRow[]>(key);
      queryClient.setQueryData<FollowUpRow[]>(key, (old) =>
        (old ?? []).filter((f) => f.id !== followUpId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["task-list", "overdue_followups", userId],
          context.previous
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["task-list", "overdue_followups", userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["task-list", "going_cold", userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["task-list", "proactive", userId],
      });
    },
  });

  // Snooze a follow-up: bump due_date by 1 day. Does NOT log an interaction.
  const snoozeFollowUp = useMutation({
    mutationFn: async ({ followUpId }: { followUpId: string }) => {
      const tomorrow = addDays(new Date(), 1).toISOString().split("T")[0];
      const { error } = await supabase
        .from("follow_ups")
        .update({ due_date: tomorrow })
        .eq("id", followUpId);
      if (error) throw error;
    },
    onMutate: async ({ followUpId }) => {
      const key = ["task-list", "overdue_followups", userId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FollowUpRow[]>(key);
      queryClient.setQueryData<FollowUpRow[]>(key, (old) =>
        (old ?? []).filter((f) => f.id !== followUpId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["task-list", "overdue_followups", userId],
          context.previous
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["task-list", "overdue_followups", userId],
      });
    },
  });

  // Quick log: a one-shot interaction for going_cold / proactive buckets.
  // No follow-up record is touched. The interactions trigger refreshes
  // agent_health, which removes the contact from the bucket on next fetch.
  const logQuickInteraction = useMutation({
    mutationFn: async ({
      contactId,
      interactionType,
      summary,
    }: {
      contactId: string;
      interactionType: "call" | "email";
      summary: string;
    }) => {
      if (!userId) throw new Error("No user");
      const { error } = await supabase.from("interactions").insert({
        user_id: userId,
        contact_id: contactId,
        type: interactionType,
        summary,
        direction: "outbound",
      });
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["task-list", "going_cold", userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["task-list", "proactive", userId],
      });
    },
  });

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  const isLoading =
    followUpsQuery.isLoading ||
    closingsQuery.isLoading ||
    goingColdQuery.isLoading ||
    proactiveQuery.isLoading ||
    pipelineQuery.isLoading;

  const totalCount =
    (followUpsQuery.data?.length ?? 0) +
    (closingsQuery.data?.length ?? 0) +
    (goingColdQuery.data?.length ?? 0) +
    (proactiveQuery.data?.length ?? 0) +
    (pipelineQuery.data?.length ?? 0);

  return (
    <Card
      role="region"
      aria-label="Today's focus task list"
      className="overflow-hidden"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#e63550]" aria-hidden="true" />
            Today&apos;s Focus
          </span>
          {!isLoading && (
            <span
              className="font-mono text-xs text-muted-foreground"
              aria-live="polite"
              aria-atomic="true"
            >
              {totalCount} {totalCount === 1 ? "action" : "actions"}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {isLoading ? (
          <div className="space-y-2 py-1" aria-label="Loading focus list">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-12 rounded-md bg-secondary animate-pulse"
              />
            ))}
          </div>
        ) : totalCount === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2"
            aria-live="polite"
          >
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
            <p className="text-sm">All clear. Nothing demands you right now.</p>
          </div>
        ) : (
          <>
            {/* Bucket 1: Overdue follow-ups */}
            <BucketSection
              label="Overdue Follow-ups"
              icon={AlertCircle}
              accent={BUCKET_COLORS.overdue_followups}
              count={followUpsQuery.data?.length ?? 0}
            >
              {(followUpsQuery.data ?? [])
                .slice(0, ITEMS_PER_BUCKET)
                .map((f) => (
                  <FollowUpRowView
                    key={f.id}
                    row={f}
                    onCall={() =>
                      completeFollowUp.mutate({
                        followUpId: f.id,
                        contactId: f.contact_id,
                        reason: f.reason,
                        interactionType: "call",
                      })
                    }
                    onEmail={() =>
                      completeFollowUp.mutate({
                        followUpId: f.id,
                        contactId: f.contact_id,
                        reason: f.reason,
                        interactionType: "email",
                      })
                    }
                    onSnooze={() => snoozeFollowUp.mutate({ followUpId: f.id })}
                  />
                ))}
              {(followUpsQuery.data?.length ?? 0) > ITEMS_PER_BUCKET && (
                <ViewMoreLink
                  href="/actions"
                  label={`View ${(followUpsQuery.data?.length ?? 0) - ITEMS_PER_BUCKET} more`}
                />
              )}
            </BucketSection>

            {/* Bucket 2: Closings */}
            <BucketSection
              label="Closings Today / Tomorrow"
              icon={Home}
              accent={BUCKET_COLORS.closings}
              count={closingsQuery.data?.length ?? 0}
            >
              {(closingsQuery.data ?? [])
                .slice(0, ITEMS_PER_BUCKET)
                .map((d) => (
                  <ClosingRowView key={d.id} row={d} />
                ))}
            </BucketSection>

            {/* Bucket 3: Going cold */}
            <BucketSection
              label="Agents Going Cold"
              icon={Snowflake}
              accent={BUCKET_COLORS.going_cold}
              count={goingColdQuery.data?.length ?? 0}
            >
              {(goingColdQuery.data ?? [])
                .slice(0, ITEMS_PER_BUCKET)
                .map((r) => (
                  <HealthRowView
                    key={r.contact_id}
                    row={r}
                    summaryPrefix="Reconnect"
                    onCall={() =>
                      logQuickInteraction.mutate({
                        contactId: r.contact_id,
                        interactionType: "call",
                        summary: "Reconnect: warming up cooling relationship",
                      })
                    }
                    onEmail={() =>
                      logQuickInteraction.mutate({
                        contactId: r.contact_id,
                        interactionType: "email",
                        summary: "Reconnect: warming up cooling relationship",
                      })
                    }
                  />
                ))}
            </BucketSection>

            {/* Bucket 5: Proactive touchpoints */}
            <BucketSection
              label="Proactive Touchpoints"
              icon={Sparkles}
              accent={BUCKET_COLORS.proactive}
              count={proactiveQuery.data?.length ?? 0}
            >
              {(proactiveQuery.data ?? [])
                .slice(0, ITEMS_PER_BUCKET)
                .map((r) => (
                  <HealthRowView
                    key={r.contact_id}
                    row={r}
                    summaryPrefix="Touch base"
                    onCall={() =>
                      logQuickInteraction.mutate({
                        contactId: r.contact_id,
                        interactionType: "call",
                        summary: "Proactive touchpoint",
                      })
                    }
                    onEmail={() =>
                      logQuickInteraction.mutate({
                        contactId: r.contact_id,
                        interactionType: "email",
                        summary: "Proactive touchpoint",
                      })
                    }
                  />
                ))}
            </BucketSection>

            {/* Bucket 6: Stalled pipeline */}
            <BucketSection
              label="Pipeline Needs Attention"
              icon={TrendingDown}
              accent={BUCKET_COLORS.stalled_pipeline}
              count={pipelineQuery.data?.length ?? 0}
            >
              {(pipelineQuery.data ?? [])
                .slice(0, ITEMS_PER_BUCKET)
                .map((o) => (
                  <PipelineRowView key={o.id} row={o} />
                ))}
            </BucketSection>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Sub-components
// ============================================================

function BucketSection({
  label,
  icon: Icon,
  accent,
  count,
  children,
}: {
  label: string;
  icon: typeof AlertCircle;
  accent: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section
      role="group"
      aria-label={`${label}, ${count} ${count === 1 ? "item" : "items"}`}
      className="border-l-2 pl-3"
      style={{ borderLeftColor: accent }}
    >
      <header className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Icon
            className="h-3.5 w-3.5"
            aria-hidden="true"
            style={{ color: accent }}
          />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            {label}
          </h3>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{count}</span>
      </header>
      <ul role="list" className="space-y-1">
        {children}
      </ul>
    </section>
  );
}

function ActionButton({
  onClick,
  ariaLabel,
  children,
  variant,
}: {
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
  variant: "call" | "email" | "snooze";
}) {
  const colorMap = {
    call: "hover:text-green-400 hover:bg-green-900/20",
    email: "hover:text-blue-400 hover:bg-blue-900/20",
    snooze: "hover:text-amber-400 hover:bg-amber-900/20",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`min-w-[44px] min-h-[44px] sm:min-w-[28px] sm:min-h-[28px] rounded flex items-center justify-center text-muted-foreground transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63550] ${colorMap[variant]}`}
    >
      {children}
    </button>
  );
}

function TierBadge({ tier }: { tier: ContactRef["tier"] }) {
  const tierStyles: Record<string, string> = {
    A: "bg-[#e63550] text-white",
    B: "bg-[#2563eb] text-white",
    C: "bg-[#a1a1aa] text-white",
    P: "bg-[#222228] text-[#a1a1aa]",
  };
  const cls = tier ? tierStyles[tier] : "bg-[#222228] text-[#a1a1aa]";
  return (
    <span
      aria-label={tier ? `Tier ${tier}` : "No tier"}
      className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${cls}`}
    >
      {tier ?? "-"}
    </span>
  );
}

function FollowUpRowView({
  row,
  onCall,
  onEmail,
  onSnooze,
}: {
  row: FollowUpRow;
  onCall: () => void;
  onEmail: () => void;
  onSnooze: () => void;
}) {
  const name = contactName(row.contacts);
  return (
    <li
      role="listitem"
      className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-secondary/50 transition-colors"
    >
      <TierBadge tier={row.contacts?.tier ?? null} />
      <Link
        href={`/contacts/${row.contact_id}`}
        className="flex-1 min-w-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63550] rounded"
      >
        <p className="text-sm font-medium text-foreground truncate leading-tight">
          {name}
        </p>
        <p className="text-xs text-muted-foreground truncate leading-tight">
          {row.reason}
          <span className="font-mono ml-1">&middot; {formatRelative(row.due_date)}</span>
        </p>
      </Link>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <ActionButton
          onClick={onCall}
          ariaLabel={`Log call and complete follow-up with ${name}`}
          variant="call"
        >
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
        </ActionButton>
        <ActionButton
          onClick={onEmail}
          ariaLabel={`Log email and complete follow-up with ${name}`}
          variant="email"
        >
          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
        </ActionButton>
        <ActionButton
          onClick={onSnooze}
          ariaLabel={`Snooze follow-up with ${name} until tomorrow`}
          variant="snooze"
        >
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        </ActionButton>
      </div>
    </li>
  );
}

function ClosingRowView({ row }: { row: ClosingRow }) {
  const name = contactName(row.contacts);
  return (
    <li
      role="listitem"
      className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-secondary/50 transition-colors"
    >
      <TierBadge tier={row.contacts?.tier ?? null} />
      <Link
        href={`/contacts/${row.contact_id}`}
        className="flex-1 min-w-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316] rounded"
      >
        <p className="text-sm font-medium text-foreground truncate leading-tight">
          {name}
        </p>
        <p className="text-xs text-muted-foreground truncate leading-tight">
          {row.property_address}
          <span className="font-mono ml-1">
            &middot; {format(new Date(row.scheduled_close_date), "MMM d")}
          </span>
        </p>
      </Link>
      <Link
        href={`/contacts/${row.contact_id}`}
        aria-label={`View deal for ${name}`}
        className="min-w-[44px] min-h-[44px] sm:min-w-[28px] sm:min-h-[28px] rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[#f97316]/10 transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </li>
  );
}

function HealthRowView({
  row,
  summaryPrefix,
  onCall,
  onEmail,
}: {
  row: AgentHealthRow;
  summaryPrefix: string;
  onCall: () => void;
  onEmail: () => void;
}) {
  const name = contactName(row.contacts);
  const days = row.days_since_contact ?? 0;
  return (
    <li
      role="listitem"
      className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-secondary/50 transition-colors"
    >
      <TierBadge tier={row.contacts?.tier ?? null} />
      <Link
        href={`/contacts/${row.contact_id}`}
        className="flex-1 min-w-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63550] rounded"
      >
        <p className="text-sm font-medium text-foreground truncate leading-tight">
          {name}
        </p>
        <p className="text-xs text-muted-foreground truncate leading-tight">
          {summaryPrefix}
          <span className="font-mono ml-1">
            &middot; {days}d ago &middot; health{" "}
            {row.health_score ?? 0}
          </span>
        </p>
      </Link>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <ActionButton
          onClick={onCall}
          ariaLabel={`Log call to ${name}`}
          variant="call"
        >
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
        </ActionButton>
        <ActionButton
          onClick={onEmail}
          ariaLabel={`Log email to ${name}`}
          variant="email"
        >
          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
        </ActionButton>
      </div>
    </li>
  );
}

function PipelineRowView({ row }: { row: OpportunityRow }) {
  const name = contactName(row.contacts);
  const opened = row.opened_at ? formatRelative(row.opened_at) : "unknown";
  return (
    <li
      role="listitem"
      className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-secondary/50 transition-colors"
    >
      <TierBadge tier={row.contacts?.tier ?? null} />
      <Link
        href={`/contacts/${row.contact_id}`}
        className="flex-1 min-w-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71717a] rounded"
      >
        <p className="text-sm font-medium text-foreground truncate leading-tight">
          {name}
        </p>
        <p className="text-xs text-muted-foreground truncate leading-tight">
          {row.property_address ?? "Opportunity"}
          <span className="font-mono ml-1">
            &middot; {row.stage ?? "active"} &middot; opened {opened}
          </span>
        </p>
      </Link>
      <Link
        href={`/contacts/${row.contact_id}`}
        aria-label={`View opportunity for ${name}`}
        className="min-w-[44px] min-h-[44px] sm:min-w-[28px] sm:min-h-[28px] rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[#71717a]/10 transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71717a]"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </li>
  );
}

function ViewMoreLink({ href, label }: { href: string; label: string }) {
  return (
    <li role="listitem" className="px-1 pt-1">
      <Link
        href={href}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63550] rounded"
      >
        {label} &rarr;
      </Link>
    </li>
  );
}
