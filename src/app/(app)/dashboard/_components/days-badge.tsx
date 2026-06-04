import { Check, Clock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// Color-coded recency badge. Tone is driven by drift (days past the contact's
// tier cadence) when available, else by raw days-since. Never-touched reads
// danger. Shared by the reach-out list and the Agents roster.
export function DaysBadge({
  days,
  drift,
}: {
  days: number | null;
  drift?: number;
}) {
  let tone: "danger" | "warning" | "success";
  if (days === null) tone = "danger";
  else if (drift !== undefined)
    tone = drift > 0 ? "danger" : drift >= -2 ? "warning" : "success";
  else tone = days >= 14 ? "danger" : days >= 7 ? "warning" : "success";

  const label = days === null ? "Never" : `${days}d`;
  const cls = {
    danger: "bg-red-50 text-red-700 ring-red-600/20",
    warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  }[tone];

  // Non-color tone channel so red/green color-blind users can still read status
  // (WCAG 1.4.1). The leading icon shape differs by tone, and the status word is
  // carried in the aria-label for screen readers. Color stays as reinforcement.
  const Icon = {
    danger: TriangleAlert,
    warning: Clock,
    success: Check,
  }[tone];
  const statusWord = {
    danger: "overdue",
    warning: "due soon",
    success: "on track",
  }[tone];

  return (
    <span
      aria-label={`${label}, ${statusWord}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset",
        cls,
      )}
    >
      <Icon aria-hidden className="h-3 w-3" />
      {label}
    </span>
  );
}
