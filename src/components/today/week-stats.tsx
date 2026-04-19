"use client";

import type { TodayPayloadT } from "@/lib/spine/types";
import { BarChart3 } from "lucide-react";

type WeekSummary = TodayPayloadT["week_rotation_summary"];

interface WeekStatsSectionProps {
  weekSummary: WeekSummary;
  signalCount: number;
}

export function WeekStatsSection({
  weekSummary,
  signalCount,
}: WeekStatsSectionProps) {
  const stats = [
    {
      label: "Rotation Total",
      value: weekSummary.total,
    },
    {
      label: "Touched",
      value: weekSummary.touched,
    },
    {
      label: "Pending",
      value: weekSummary.pending,
    },
    {
      label: "Skipped",
      value: weekSummary.skipped,
    },
    {
      label: "Active Signals",
      value: signalCount,
    },
  ];

  return (
    <section role="region" aria-label="Weekly stats">
      <div className="flex items-center gap-3 mb-3">
        <BarChart3 className="h-4 w-4 text-emerald-500" />
        <h2
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          This Week
        </h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-border p-3 text-center"
          >
            <p
              className="text-2xl font-medium font-mono text-foreground"
              aria-live="polite"
            >
              {s.value}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
