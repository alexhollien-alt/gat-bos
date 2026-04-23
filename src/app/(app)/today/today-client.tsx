"use client";

import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { InboxSummaryCard } from "@/components/today/inbox-summary-card";
import { DraftsPending } from "@/components/today/drafts-pending";
import { ProjectsActive } from "@/components/today/projects-active";
import { TouchpointsDue } from "@/components/today/touchpoints-due";
import { Inbox, RefreshCw } from "lucide-react";
import { AccentRule, PageHeader, SectionShell, TodayEvents } from "@/components/screen";

export function TodayClient() {
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

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

      <div className="space-y-6">
        {/* Section D: Inbox Highlights */}
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
      </div>
    </SectionShell>
  );
}
