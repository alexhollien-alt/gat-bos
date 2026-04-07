"use client";

import { createClient } from "@/lib/supabase/client";
import { FollowUp } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { Check, SkipForward } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export function FollowUpRow({
  followUp,
  onUpdate,
}: {
  followUp: FollowUp;
  onUpdate: () => void;
}) {
  const supabase = createClient();
  const isOverdue =
    isPast(new Date(followUp.due_date)) &&
    !isToday(new Date(followUp.due_date)) &&
    followUp.status === "pending";
  const isDueToday = isToday(new Date(followUp.due_date));

  async function markStatus(status: "completed" | "skipped") {
    const { error } = await supabase
      .from("follow_ups")
      .update({
        status,
        completed_at: new Date().toISOString(),
      })
      .eq("id", followUp.id);
    if (error) {
      toast.error("Failed to update");
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
        followUp.status !== "pending" && "opacity-60"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">{followUp.reason}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {followUp.contacts && (
            <Link
              href={`/contacts/${followUp.contacts.id}`}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              {followUp.contacts.first_name} {followUp.contacts.last_name}
            </Link>
          )}
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
            {format(new Date(followUp.due_date), "MMM d")}
          </span>
        </div>
      </div>
      {followUp.status === "pending" && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-green-400 hover:text-green-300"
            onClick={() => markStatus("completed")}
            title="Mark complete"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => markStatus("skipped")}
            title="Skip"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
