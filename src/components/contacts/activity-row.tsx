"use client";

import { ActivityEvent, formatActivityTime } from "@/lib/contact-activity";
import {
  Phone,
  MessageSquare,
  Mail,
  Users,
  Building,
  UtensilsCrossed,
  FileText,
  CheckCircle2,
  Clock,
  Printer,
  FileImage,
  Circle,
  LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Phone,
  MessageSquare,
  Mail,
  Users,
  Building,
  UtensilsCrossed,
  FileText,
  CheckCircle2,
  Clock,
  Printer,
  FileImage,
  Circle,
};

const SUMMARY_TRUNCATE = 90;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "...";
}

export function ActivityRow({ event }: { event: ActivityEvent }) {
  const Icon = ICON_MAP[event.iconName] ?? Circle;

  return (
    <div className="group relative flex gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors">
      {/* Source color bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${event.barColorClass} opacity-60 group-hover:opacity-100 transition-opacity`}
        aria-hidden="true"
      />

      <div className="flex-shrink-0 mt-0.5 ml-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            {event.sourceLabel}
          </span>
          {event.badge && (
            <span className="text-[10px] font-mono uppercase text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
              {event.badge.replace(/_/g, " ")}
            </span>
          )}
          <span className="text-muted-foreground text-xs">·</span>
          <span className="font-mono text-xs text-muted-foreground">
            {formatActivityTime(event.timestamp)}
          </span>
        </div>
        <p className="text-sm text-foreground/90 leading-snug">
          {truncate(event.summary, SUMMARY_TRUNCATE)}
        </p>
      </div>
    </div>
  );
}
