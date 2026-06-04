"use client";

// RIGHT pane of the Today tab: open tasks, checkable inline, add-new pinned at
// the bottom. Completing optimistically removes the row and bumps the counter.

import { useOpenTasks, useToggleTask, useAddTask } from "../queries";
import { TodoRow } from "./todo-row";
import { AddTaskRow } from "./add-task-row";

export function TodoList() {
  const { data, isLoading } = useOpenTasks();
  const toggle = useToggleTask();
  const add = useAddTask();
  const tasks = data ?? [];

  return (
    <section className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">To-do</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </header>
      <ul className="min-h-0 flex-1 overflow-y-auto p-1">
        {isLoading ? (
          <li className="px-3 py-8 text-center text-sm text-muted-foreground">
            Loading...
          </li>
        ) : tasks.length === 0 ? (
          <li className="px-3 py-8 text-center text-sm text-muted-foreground">
            Nothing open
          </li>
        ) : (
          tasks.map((t) => (
            <TodoRow
              key={t.id}
              task={t}
              onToggle={(id, completed) => toggle.mutate({ task_id: id, completed })}
            />
          ))
        )}
      </ul>
      <AddTaskRow onAdd={(title) => add.mutate({ title })} />
    </section>
  );
}
