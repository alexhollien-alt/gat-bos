"use client";

import { useEffect, useState, useCallback } from "react";
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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("active");
  const [showForm, setShowForm] = useState(false);
  const supabase = createClient();

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

    const { data } = await query;
    if (data) setTasks(data);
  }, [filter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Tasks</h1>
        <div className="flex items-center gap-2">
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
      </div>

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No tasks</p>
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
    </div>
  );
}
