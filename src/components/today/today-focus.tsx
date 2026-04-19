"use client";

import type { TodayPayloadT } from "@/lib/spine/types";
import { Target, Phone, MessageSquare } from "lucide-react";
import Link from "next/link";

type FocusItem = TodayPayloadT["today_focus"][number];
type WeekSummary = TodayPayloadT["week_rotation_summary"];

interface TodayFocusSectionProps {
  focusItems: FocusItem[];
  weekSummary: WeekSummary;
}

export function TodayFocusSection({
  focusItems,
  weekSummary,
}: TodayFocusSectionProps) {
  return (
    <section role="region" aria-label="Today's focus">
      <div className="flex items-center gap-3 mb-3">
        <Target className="h-4 w-4 text-blue-500" />
        <h2
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          This Week&apos;s Focus
        </h2>
        <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
          {weekSummary.touched}/{weekSummary.total} touched
        </span>
      </div>

      {focusItems.length === 0 ? (
        <div className="rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {weekSummary.total === 0
              ? "No focus rotation built for this week yet."
              : "All focus contacts have been touched this week."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {focusItems.map((item, i) => (
            <FocusCard key={item.focus.id} item={item} rank={i + 1} />
          ))}
        </div>
      )}
    </section>
  );
}

function FocusCard({ item, rank }: { item: FocusItem; rank: number }) {
  const { focus, contact } = item;
  const name = `${contact.first_name} ${contact.last_name}`;
  const tier = contact.tier ?? "?";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3 hover:border-white/[0.12] transition-colors">
      <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-secondary text-xs font-mono text-muted-foreground">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/contacts/${contact.id}`}
            className="text-sm font-medium text-foreground hover:underline truncate"
          >
            {name}
          </Link>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
            {tier}
          </span>
        </div>
        {focus.suggested_action && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {focus.suggested_action}
          </p>
        )}
        {focus.reason && (
          <span className="text-[10px] font-mono text-muted-foreground">
            {focus.reason}
            {focus.reason_detail ? ` -- ${focus.reason_detail}` : ""}
          </span>
        )}
      </div>
      <div className="flex gap-1 ml-2 shrink-0">
        <a
          href={`sms:?body=Hey ${contact.first_name}`}
          className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Text ${name}`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </a>
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Call ${name}`}
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
