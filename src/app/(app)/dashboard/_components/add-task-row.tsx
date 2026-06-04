"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

export function AddTaskRow({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = value.trim();
    if (!t) return;
    onAdd(t);
    setValue("");
  }

  return (
    <form onSubmit={submit} className="shrink-0 border-t border-border p-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a task, press Enter"
        className="h-9"
        aria-label="Add a task"
      />
    </form>
  );
}
