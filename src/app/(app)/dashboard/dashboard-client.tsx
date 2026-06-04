"use client";

// DashboardClient -- thin shell. Renders the live topbar counters and the
// three-tab switch (Today / Agents / Activity). Every query lives in the leaf
// that renders it; this component holds only the active-tab state. Hydrates
// from the prefetch cache set in page.tsx (matching query keys).

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopbarCounters } from "./_components/topbar-counters";
import { TodayTab } from "./_components/today-tab";
import { AgentsTab } from "./_components/agents-tab";
import { ActivityTab } from "./_components/activity-tab";

// Format in Phoenix wall-clock so the UTC server and the Phoenix client render
// the same string. Plain date-fns format() uses the runtime local TZ, which
// drifts a calendar day between server and browser for the evening hours and
// triggers a hydration mismatch.
const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "America/Phoenix",
});

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
            {dateFmt.format(new Date())}
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
