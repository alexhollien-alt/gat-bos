"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { FollowUp } from "@/lib/types";
import { FollowUpRow } from "@/components/follow-ups/follow-up-list";
import { FollowUpFormModal } from "@/components/follow-ups/follow-up-form";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { AccentRule, PageHeader, SectionShell } from "@/components/screen";

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [filter, setFilter] = useState("pending");
  const [showForm, setShowForm] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const fetchFollowUps = useCallback(async () => {
    // follow_ups merged into tasks (Slice 2C). Filter rows by type='follow_up'.
    // Map status filter from FollowUpStatus to the value the UI passes:
    //   pending -> tasks rows that are not yet completed/skipped
    let query = supabase
      .from("tasks")
      .select("*, contacts(id, first_name, last_name)")
      .eq("type", "follow_up")
      .order("due_date", { ascending: true });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data } = await query;
    if (data) {
      // Cast Task rows back into the FollowUp shape that the row component expects.
      // due_reason holds the migrated reason; title is the COALESCE fallback.
      const mapped = data.map((row: Record<string, unknown>) => ({
        ...row,
        reason: (row.due_reason as string | null) ?? (row.title as string),
      })) as unknown as FollowUp[];
      setFollowUps(mapped);
    }
  }, [filter, supabase]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  return (
    <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0 max-w-3xl mx-0">
      <PageHeader
        eyebrow="Cadence"
        title="Follow-ups"
        right={
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowForm(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Schedule follow-up
            </Button>
          </div>
        }
      />
      <AccentRule variant="hairline" className="mt-6 mb-6" />

      <div className="space-y-2">
        {followUps.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No follow-ups
          </p>
        ) : (
          followUps.map((fu) => (
            <FollowUpRow key={fu.id} followUp={fu} onUpdate={fetchFollowUps} />
          ))
        )}
      </div>

      <FollowUpFormModal
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={fetchFollowUps}
      />
    </SectionShell>
  );
}
