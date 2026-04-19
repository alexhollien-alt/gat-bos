"use client";

/**
 * TodayClient -- the morning command screen.
 *
 * Consumes the prefetched spine payload via useQuery with the same key
 * as the server prefetch. staleTime 30s per dashboard.md Section 6 for
 * task/action-oriented data.
 *
 * Workspace tier: no glass, no noise, no gradient mesh, no page-load
 * animations. Dark color system via CSS variables.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TodayPayloadT } from "@/lib/spine/types";
import { format } from "date-fns";
import { TierAlertsSection } from "@/components/today/tier-alerts";
import { OverdueCommitmentsSection } from "@/components/today/overdue-commitments";
import { TodayFocusSection } from "@/components/today/today-focus";
import { RecentCapturesSection } from "@/components/today/recent-captures";
import { WeekStatsSection } from "@/components/today/week-stats";
import { InboxSummaryCard } from "@/components/today/inbox-summary-card";
import { DraftsPending } from "@/components/today/drafts-pending";
import { ProjectsActive } from "@/components/today/projects-active";
import { TouchpointsDue } from "@/components/today/touchpoints-due";
import { Inbox, RefreshCw } from "lucide-react";
import { AccentRule, PageHeader, SectionShell, TodayEvents } from "@/components/screen";

export function TodayClient() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data, isLoading, dataUpdatedAt } = useQuery<TodayPayloadT>({
    queryKey: ["spine", "today"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const res = await fetch("/api/spine/today");
      if (!res.ok) throw new Error("Failed to fetch today payload");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["spine", "today"] });
  };

  const payload = data ?? null;
  const now = new Date();

  return (
    <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0 max-w-5xl mx-0">
      <PageHeader
        eyebrow="This morning"
        title="Today"
        subhead={
          <span className="font-mono tracking-wide">
            {format(now, "EEEE, MMMM d, yyyy")}
          </span>
        }
        right={
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
            aria-label="Refresh today view"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />
      <AccentRule variant="hairline" className="mt-6 mb-6" />

      {isLoading && !payload ? (
        <div className="text-muted-foreground text-sm">Loading...</div>
      ) : !payload ? (
        <div className="text-muted-foreground text-sm">
          No data available. Sign in to see your Today View.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section A: Tier Alerts -- agents approaching or past their cadence threshold */}
          <TierAlertsSection comingDue={payload.coming_due} />

          {/* Section B: Overdue Commitments -- promises past due */}
          <OverdueCommitmentsSection
            commitments={payload.overdue_commitments}
          />

          {/* Section C: Today's Focus -- this week's rotation picks */}
          <TodayFocusSection
            focusItems={payload.today_focus}
            weekSummary={payload.week_rotation_summary}
          />

          {/* Section D: Inbox Highlights -- live once Gmail sync is connected */}
          <section role="region" aria-label="Inbox">
            <div className="flex items-center gap-3 mb-3">
              <Inbox className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                Inbox
              </h2>
            </div>
            <InboxSummaryCard />
          </section>

          {/* Section D.1: Pending drafts -- Phase 8 unified dashboard.
              Realtime on email_drafts (latency-sensitive per plan Phase 8 task 3). */}
          <DraftsPending />

          {/* Section E: Calendar -- live via Phase 1.5 Google Calendar sync */}
          <TodayEvents />

          {/* Section E.1: Active projects -- Phase 8 unified dashboard */}
          <ProjectsActive />

          {/* Section E.2: Touchpoints with occurred_at IS NULL on active projects */}
          <TouchpointsDue />

          {/* Section F: Recent Captures -- unprocessed brain dumps */}
          <RecentCapturesSection captures={payload.recent_captures} />

          {/* Section G: Quick Stats */}
          <WeekStatsSection
            weekSummary={payload.week_rotation_summary}
            signalCount={payload.high_signals.length}
          />
        </div>
      )}

      {/* Last updated indicator */}
      {dataUpdatedAt > 0 && (
        <p className="text-xs text-muted-foreground mt-6 font-mono" aria-live="polite">
          Last refreshed {format(new Date(dataUpdatedAt), "h:mm:ss a")}
        </p>
      )}
    </SectionShell>
  );
}
