import { cn } from "@/lib/utils";

// Inline progress bar (shadcn Progress is not installed). Fills with the
// primary token; turns green once the goal is met.
export function ProgressBar({
  value,
  goal,
  className,
}: {
  value: number;
  goal: number;
  className?: string;
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  const reached = value >= goal && goal > 0;
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={goal}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          reached ? "bg-emerald-500" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
