"use client";

import { Task } from "@/lib/types";
import { TaskRow } from "@/components/tasks/task-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare } from "lucide-react";

export function TasksDueWidget({
  tasks,
  onUpdate,
}: {
  tasks: Task[];
  onUpdate: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          Tasks Due
          {tasks.length > 0 && (
            <span className="bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full">
              {tasks.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">No tasks due</p>
        ) : (
          tasks.slice(0, 5).map((task) => (
            <TaskRow key={task.id} task={task} onUpdate={onUpdate} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
