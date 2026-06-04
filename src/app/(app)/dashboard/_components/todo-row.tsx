"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { OpenTask } from "../_data";

function formatDue(due: string): string {
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

export function TodoRow({
  task,
  onToggle,
}: {
  task: OpenTask;
  onToggle: (id: string, completed: boolean) => void;
}) {
  // Optimistic rows (temp id) cannot be toggled until reconciled to a real id.
  const optimistic = task.id.startsWith("temp-");
  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60">
      <Checkbox
        checked={false}
        disabled={optimistic}
        onCheckedChange={(v) => onToggle(task.id, v === true)}
        className="shrink-0"
        aria-label={`Complete: ${task.title}`}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm text-foreground",
          optimistic && "opacity-50",
        )}
      >
        {task.title}
      </span>
      {task.due_date && (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatDue(task.due_date)}
        </span>
      )}
    </li>
  );
}
