"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Task } from "@/lib/types";
import { TaskRow } from "@/components/tasks/task-list";
import { TaskFormModal } from "@/components/tasks/task-form";
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

const TYPE_VALUES = new Set(["todo", "follow_up", "commitment"]);

export function TasksClient() {
  const searchParams = useSearchParams();
  const initialType = (() => {
    const t = searchParams.get("type");
    return t && TYPE_VALUES.has(t) ? t : "all";
  })();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("active");
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [showForm, setShowForm] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const fetchTasks = useCallback(async () => {
    let query = supabase
      .from("tasks")
      .select("*, contacts(id, first_name, last_name)")
      .order("due_date", { ascending: true, nullsFirst: false });

    if (filter === "active") {
      query = query.neq("status", "completed");
    } else if (filter === "completed") {
      query = query.eq("status", "completed");
    }

    if (typeFilter !== "all") {
      query = query.eq("type", typeFilter);
    }

    const { data } = await query;
    if (data) setTasks(data);
  }, [filter, typeFilter, supabase]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0 max-w-3xl mx-0">
      <PageHeader
        title="Tasks"
        right={
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="todo">Todo</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="commitment">Commitment</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowForm(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add task
            </Button>
          </div>
        }
      />
      <AccentRule variant="hairline" className="mt-6 mb-6" />

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No tasks</p>
        ) : (
          tasks.map((task) => (
            <TaskRow key={task.id} task={task} onUpdate={fetchTasks} />
          ))
        )}
      </div>

      <TaskFormModal
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={fetchTasks}
      />
    </SectionShell>
  );
}
