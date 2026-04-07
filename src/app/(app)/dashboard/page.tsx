"use client";

import { useEffect, useState, useCallback } from "react";
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
import { format } from "date-fns";

export default function DashboardPage() {
  const supabase = createClient();

  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [hotContacts, setHotContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [recentInteractions, setRecentInteractions] = useState<Interaction[]>(
    []
  );
  const [stats, setStats] = useState<Record<RelationshipStrength, number>>({
    new: 0,
    warm: 0,
    active_partner: 0,
    advocate: 0,
    dormant: 0,
  });

  const fetchAll = useCallback(async () => {
    // Hottest contacts
    const { data: tempData } = await supabase
      .from("contacts")
      .select("*")
      .is("deleted_at", null)
      .gt("health_score", 0)
      .order("health_score", { ascending: false })
      .limit(8);
    if (tempData) setHotContacts(tempData);

    // All contacts (for health banner + relationship stats)
    const { data: contactsData } = await supabase
      .from("contacts")
      .select("*")
      .is("deleted_at", null)
      .order("first_name", { ascending: true });

    if (contactsData) {
      setAllContacts(contactsData);

      const counts: Record<RelationshipStrength, number> = {
        new: 0,
        warm: 0,
        active_partner: 0,
        advocate: 0,
        dormant: 0,
      };
      contactsData.forEach((c) => {
        const r = c.relationship as RelationshipStrength;
        if (r in counts) counts[r]++;
      });
      setStats(counts);
    }

    // Opportunities
    const { data: oppData } = await supabase
      .from("opportunities")
      .select("*, contacts(id, first_name, last_name)")
      .order("created_at", { ascending: false });
    if (oppData) setOpportunities(oppData);

    // Recent interactions
    const { data: intData } = await supabase
      .from("interactions")
      .select("*, contacts(id, first_name, last_name)")
      .order("occurred_at", { ascending: false })
      .limit(8);
    if (intData) setRecentInteractions(intData);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="max-w-7xl">
      {/* Top row: Today header (left) + Print Tickets panel (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-1 flex flex-col justify-center">
          <h1 className="text-2xl font-semibold text-foreground font-display">
            Today
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono tracking-wide">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <div className="lg:col-span-2">
          <PrintTicketsPanel />
        </div>
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
          <QuickActionsWidget onRefresh={fetchAll} />
          <RelationshipStatsWidget stats={stats} />
          <RecentInteractionsWidget interactions={recentInteractions} />
        </div>
      </div>
    </div>
  );
}
