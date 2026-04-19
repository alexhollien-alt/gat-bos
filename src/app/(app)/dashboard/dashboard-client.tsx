"use client";

/**
 * DashboardClient -- client-side consumer of the dashboard prefetch cache.
 *
 * Per ~/.claude/rules/dashboard.md Section 6, the dashboard page is a Server
 * Component that prefetches four queries and hands the dehydrated cache here
 * via <HydrationBoundary>. This component reads those caches through useQuery
 * with identical keys, so first paint ships with real data and subsequent
 * mutations (QuickActionsWidget.onRefresh, realtime) invalidate through the
 * shared client.
 *
 * staleTime per dashboard.md Section 6:
 *   - KPI cards (hot contacts, all contacts, opportunities): 60s
 *   - Activity feeds (recent interactions): 30s
 *
 * Realtime is NOT wired here yet. Follow-up commit will add Supabase Realtime
 * subscriptions that call queryClient.invalidateQueries(["dashboard"]).
 */

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  Contact,
  Interaction,
  Opportunity,
  RelationshipStrength,
} from "@/lib/types";
import { HealthLeadersWidget } from "@/components/dashboard/health-leaders";
import { HealthSummaryBanner } from "@/components/dashboard/health-summary";
import { PipelineSnapshotWidget } from "@/components/dashboard/pipeline-snapshot";
import { RecentInteractionsWidget } from "@/components/dashboard/recent-interactions";
import { RelationshipStatsWidget } from "@/components/dashboard/relationship-stats";
import { QuickActionsWidget } from "@/components/dashboard/quick-actions";
import { TaskListWidget } from "@/components/dashboard/task-list";
import { PrintTicketsPanel } from "@/components/dashboard/print-tickets-panel";
import { CampaignTimelineWidget } from "@/components/dashboard/campaign-timeline";
import { AccentRule, PageHeader, SectionShell, useFadeInUp } from "@/components/screen";
import { format } from "date-fns";

export function DashboardClient() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const hotContactsQuery = useQuery<Contact[]>({
    queryKey: ["dashboard", "hot_contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .is("deleted_at", null)
        .gt("health_score", 0)
        .order("health_score", { ascending: false })
        .limit(8);
      return (data ?? []) as Contact[];
    },
    staleTime: 60 * 1000,
  });

  const allContactsQuery = useQuery<Contact[]>({
    queryKey: ["dashboard", "all_contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .is("deleted_at", null)
        .order("first_name", { ascending: true });
      return (data ?? []) as Contact[];
    },
    staleTime: 60 * 1000,
  });

  const opportunitiesQuery = useQuery<Opportunity[]>({
    queryKey: ["dashboard", "opportunities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("*, contacts(id, first_name, last_name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as Opportunity[];
    },
    staleTime: 60 * 1000,
  });

  const recentInteractionsQuery = useQuery<Interaction[]>({
    queryKey: ["dashboard", "recent_interactions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("interactions")
        .select("*, contacts(id, first_name, last_name)")
        .order("occurred_at", { ascending: false })
        .limit(8);
      return (data ?? []) as unknown as Interaction[];
    },
    staleTime: 30 * 1000,
  });

  const allContacts = allContactsQuery.data ?? [];
  const hotContacts = hotContactsQuery.data ?? [];
  const opportunities = opportunitiesQuery.data ?? [];
  const recentInteractions = recentInteractionsQuery.data ?? [];

  const stats = useMemo(() => {
    const counts: Record<RelationshipStrength, number> = {
      new: 0,
      warm: 0,
      active_partner: 0,
      advocate: 0,
      dormant: 0,
    };
    allContacts.forEach((c) => {
      // DB column is `stage`, not `relationship` (see src/lib/types.ts).
      const r = c.stage as RelationshipStrength;
      if (r in counts) counts[r]++;
    });
    return counts;
  }, [allContacts]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const fade = useFadeInUp<HTMLDivElement>({ variant: "workspace" });

  return (
    <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0 max-w-7xl mx-0">
      <div ref={fade.ref} style={fade.style}>
        <PageHeader
          eyebrow="Today"
          title="Dashboard"
          subhead={
            <span className="font-mono tracking-wide">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </span>
          }
        />
        <AccentRule variant="hairline" className="mt-6 mb-6" />

        {/* Print tickets row */}
        <div className="mb-6">
          <PrintTicketsPanel />
        </div>

        <HealthSummaryBanner contacts={allContacts} />

        {/* Main grid: Action queue (wider) + intelligence column */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column (2/3) -- the operational hub */}
          <div className="lg:col-span-2 space-y-4">
            <TaskListWidget />
            <CampaignTimelineWidget />
            <PipelineSnapshotWidget opportunities={opportunities} />
          </div>

          {/* Right column (1/3) -- intelligence + quick actions */}
          <div className="space-y-4">
            <HealthLeadersWidget contacts={hotContacts} />
            <QuickActionsWidget onRefresh={handleRefresh} />
            <RelationshipStatsWidget stats={stats} />
            <RecentInteractionsWidget interactions={recentInteractions} />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
