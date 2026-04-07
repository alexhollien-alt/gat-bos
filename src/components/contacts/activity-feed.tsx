"use client";

import { useMemo, useState } from "react";
import { ActivityEvent, filterByDays } from "@/lib/contact-activity";
import { ActivityRow } from "./activity-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Activity, Plus } from "lucide-react";

const RANGE_OPTIONS: { label: string; days: number | null }[] = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 12 months", days: 365 },
  { label: "All time", days: null },
];

const COLLAPSED_LIMIT = 8;

export function ActivityFeed({
  events,
  onLogInteraction,
  hasAnyHistory,
}: {
  events: ActivityEvent[];
  onLogInteraction: () => void;
  hasAnyHistory: boolean;
}) {
  const [rangeIndex, setRangeIndex] = useState(1); // Default: Last 30 days
  const [expanded, setExpanded] = useState(false);

  const range = RANGE_OPTIONS[rangeIndex];
  const filtered = useMemo(
    () => filterByDays(events, range.days),
    [events, range.days]
  );

  const visible = expanded ? filtered : filtered.slice(0, COLLAPSED_LIMIT);
  const hasMore = filtered.length > COLLAPSED_LIMIT;

  const emptyCopy = !hasAnyHistory
    ? {
        title: "No history yet.",
        body: "Start the relationship.",
        cta: "+ Log interaction",
      }
    : filtered.length === 0
      ? {
          title: `Nothing in ${range.label.toLowerCase()}.`,
          body: "Try a wider window or log a fresh touch.",
          cta: "+ Log interaction",
        }
      : null;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
            Recent Activity
          </h2>
        </div>
        <Select
          value={String(rangeIndex)}
          onValueChange={(v) => setRangeIndex(Number(v))}
        >
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((opt, i) => (
              <SelectItem key={opt.label} value={String(i)} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Body */}
      {emptyCopy ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <Activity className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-foreground mb-1">{emptyCopy.title}</p>
          <p className="text-xs text-muted-foreground mb-4">{emptyCopy.body}</p>
          <Button size="sm" variant="outline" onClick={onLogInteraction}>
            <Plus className="h-3 w-3 mr-1" />
            Log interaction
          </Button>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border">
            {visible.map((event) => (
              <ActivityRow key={event.id} event={event} />
            ))}
          </div>
          {hasMore && (
            <div className="px-4 py-2 border-t border-border bg-secondary/20">
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded
                  ? `Show fewer`
                  : `View all activity (${filtered.length}) →`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
