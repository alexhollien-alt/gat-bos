"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Contact,
  ContactTier,
  FollowUp,
  Task,
  Interaction,
  Opportunity,
  RelationshipStrength,
} from "@/lib/types";
import { FollowUpsDueWidget } from "@/components/dashboard/follow-ups-due";
import { TasksDueWidget } from "@/components/dashboard/tasks-due";
import {
  StaleContactsWidget,
  StaleContact,
  getStaleSeverity,
} from "@/components/dashboard/stale-contacts";
import { TemperatureLeadersWidget } from "@/components/dashboard/temperature-leaders";
import { TemperatureSummaryBanner } from "@/components/dashboard/temperature-summary";
import { PipelineSnapshotWidget } from "@/components/dashboard/pipeline-snapshot";
import { RecentInteractionsWidget } from "@/components/dashboard/recent-interactions";
import { RelationshipStatsWidget } from "@/components/dashboard/relationship-stats";
import { QuickActionsWidget } from "@/components/dashboard/quick-actions";
import { format } from "date-fns";

export default function DashboardPage() {
  const supabase = createClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staleContacts, setStaleContacts] = useState<StaleContact[]>([]);
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
    // Follow-ups due today or overdue
    const { data: fuData } = await supabase
      .from("follow_ups")
      .select("*, contacts(id, first_name, last_name)")
      .eq("status", "pending")
      .lte("due_date", today)
      .order("due_date", { ascending: true });
    if (fuData) setFollowUps(fuData);

    // Tasks due today or overdue
    const { data: taskData } = await supabase
      .from("tasks")
      .select("*, contacts(id, first_name, last_name)")
      .neq("status", "completed")
      .lte("due_date", today)
      .order("due_date", { ascending: true });
    if (taskData) setTasks(taskData);

    // Temperature leaders -- top 10 by temperature
    const { data: tempData } = await supabase
      .from("contacts")
      .select("*")
      .is("deleted_at", null)
      .gt("temperature", 0)
      .order("temperature", { ascending: false })
      .limit(10);
    if (tempData) setHotContacts(tempData);

    // All contacts for stale detection + stats + temperature banner
    const { data: contactsData } = await supabase
      .from("contacts")
      .select("*")
      .is("deleted_at", null)
      .order("first_name", { ascending: true });

    if (contactsData) {
      setAllContacts(contactsData);

      // Get latest interaction per contact
      const { data: latestInteractions } = await supabase
        .from("interactions")
        .select("contact_id, occurred_at")
        .order("occurred_at", { ascending: false });

      const latestByContact = new Map<string, string>();
      if (latestInteractions) {
        for (const i of latestInteractions) {
          if (!latestByContact.has(i.contact_id)) {
            latestByContact.set(i.contact_id, i.occurred_at);
          }
        }
      }

      // Tier-aware stale detection
      const stale: StaleContact[] = contactsData
        .map((c) => {
          const lastDate = latestByContact.get(c.id) || null;
          const severity = getStaleSeverity(
            c.tier as ContactTier | null,
            lastDate
          );
          return {
            ...c,
            last_interaction_at: lastDate,
            severity: severity!,
          };
        })
        .filter((c) => c.severity !== null && c.severity !== undefined)
        .sort((a, b) => {
          // Critical first, then warning, then notice
          const order: Record<string, number> = { critical: 0, warning: 1, notice: 2 };
          if (order[a.severity] !== order[b.severity]) {
            return order[a.severity] - order[b.severity];
          }
          // Within same severity, oldest first
          if (!a.last_interaction_at) return -1;
          if (!b.last_interaction_at) return 1;
          return a.last_interaction_at.localeCompare(b.last_interaction_at);
        });

      setStaleContacts(stale);

      // Relationship stats
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
  }, [today]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground font-display">Today</h1>
          <p className="text-sm text-muted-foreground mt-0.5 font-mono tracking-wide">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
      </div>

      <TemperatureSummaryBanner contacts={allContacts} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column -- action items */}
        <div className="space-y-4">
          <FollowUpsDueWidget followUps={followUps} onUpdate={fetchAll} />
          <TasksDueWidget tasks={tasks} onUpdate={fetchAll} />
          <StaleContactsWidget contacts={staleContacts} onUpdate={fetchAll} />
          <QuickActionsWidget onRefresh={fetchAll} />
        </div>

        {/* Right column -- intelligence */}
        <div className="space-y-4">
          <TemperatureLeadersWidget contacts={hotContacts} />
          <PipelineSnapshotWidget opportunities={opportunities} />
          <RelationshipStatsWidget stats={stats} />
          <RecentInteractionsWidget interactions={recentInteractions} />
        </div>
      </div>
    </div>
  );
}
