"use client";

import { useEffect, useState, useCallback } from "react";
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

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [filter, setFilter] = useState("pending");
  const [showForm, setShowForm] = useState(false);
  const supabase = createClient();

  const fetchFollowUps = useCallback(async () => {
    let query = supabase
      .from("follow_ups")
      .select("*, contacts(id, first_name, last_name)")
      .order("due_date", { ascending: true });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data } = await query;
    if (data) setFollowUps(data);
  }, [filter]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Follow-ups</h1>
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
      </div>

      <div className="space-y-2">
        {followUps.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">
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
    </div>
  );
}
