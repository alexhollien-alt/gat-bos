"use client";

// Two-column split: reach-out list (left) + to-do list (right). On desktop the
// grid is height-pinned so both panes show at once and each scrolls
// independently. Below lg it collapses to a single stacked column.

import { ReachoutList } from "./reachout-list";
import { TodoList } from "./todo-list";

export function TodayTab() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:h-[calc(100vh-15rem)] lg:grid-cols-2">
      <ReachoutList />
      <TodoList />
    </div>
  );
}
