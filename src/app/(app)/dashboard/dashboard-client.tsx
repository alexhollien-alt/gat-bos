"use client";

// DashboardClient -- thin shell. Renders the live topbar counters and the
// three-tab switch (Today / Agents / Activity). Every query lives in the leaf
// that renders it; this component holds only the active-tab state. Hydrates
// from the prefetch cache set in page.tsx (matching query keys).

import { useState } from "react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopbarCounters } from "./_components/topbar-counters";
import { TodayTab } from "./_components/today-tab";
import { AgentsTab } from "./_components/agents-tab";
import { ActivityTab } from "./_components/activity-tab";

export function DashboardClient() {
  const [tab, setTab] = useState("today");

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            className="text-xl font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Dashboard
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
        </div>
        <TopbarCounters />
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-4">
          <TodayTab />
        </TabsContent>
        <TabsContent value="agents" className="mt-4">
          <AgentsTab active={tab === "agents"} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab active={tab === "activity"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
