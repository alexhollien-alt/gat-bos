"use client";

import { createClient } from "@/lib/supabase/client";
import { Task } from "@/lib/types";
import { PRIORITY_CONFIG } from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

export function TaskRow({
  task,
  onUpdate,
}: {
  task: Task;
  onUpdate: () => void;
}) {
  const supabase = createClient();
  const isOverdue =
    task.due_date &&
    isPast(new Date(task.due_date)) &&
    !isToday(new Date(task.due_date)) &&
    task.status !== "completed";
  const isDueToday = task.due_date && isToday(new Date(task.due_date));

  async function toggleComplete() {
    const newStatus =
      task.status === "completed" ? "pending" : "completed";
    const { error } = await supabase
      .from("tasks")
      .update({
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
    if (error) {
      toast.error("Failed to update task");
    } else {
      onUpdate();
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors",
        isOverdue
          ? "border-red-500/30 bg-red-500/5"
          : isDueToday
          ? "border-yellow-500/30 bg-yellow-500/5"
          : "border-border",
        task.status === "completed" && "opacity-60"
      )}
    >
      <Checkbox
        checked={task.status === "completed"}
        onCheckedChange={toggleComplete}
      />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium text-foreground",
            task.status === "completed" && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.contacts && (
            <Link
              href={`/contacts/${task.contacts.id}`}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              {task.contacts.first_name} {task.contacts.last_name}
            </Link>
          )}
          {task.due_date && (
            <span
              className={cn(
                "text-xs",
                isOverdue
                  ? "text-red-400 font-medium"
                  : isDueToday
                  ? "text-yellow-400 font-medium"
                  : "text-muted-foreground"
              )}
            >
              {isOverdue ? "Overdue: " : ""}
              {format(new Date(task.due_date), "MMM d")}
            </span>
          )}
          <span className={cn("text-xs", PRIORITY_CONFIG[task.priority]?.color ?? "text-muted-foreground")}>
            {PRIORITY_CONFIG[task.priority]?.label ?? task.priority}
          </span>
        </div>
      </div>
    </div>
  );
}
