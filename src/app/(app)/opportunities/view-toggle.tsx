"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type OpportunityViewMode = "list" | "kanban";

const STORAGE_KEY = "opportunities.viewMode";

export function useOpportunityView(): [
  OpportunityViewMode,
  (mode: OpportunityViewMode) => void,
] {
  const [mode, setMode] = useState<OpportunityViewMode>("list");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "list" || stored === "kanban") {
      setMode(stored);
    }
  }, []);

  const updateMode = useCallback((next: OpportunityViewMode) => {
    setMode(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  return [mode, updateMode];
}

interface ViewToggleProps {
  mode: OpportunityViewMode;
  onModeChange: (mode: OpportunityViewMode) => void;
}

export function ViewToggle({ mode, onModeChange }: ViewToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Opportunities view"
      className="inline-flex items-center rounded-md border border-border bg-background/40 p-0.5"
    >
      <ToggleButton
        active={mode === "list"}
        onClick={() => onModeChange("list")}
        icon={<List className="h-3.5 w-3.5" />}
        label="List"
      />
      <ToggleButton
        active={mode === "kanban"}
        onClick={() => onModeChange("kanban")}
        icon={<LayoutGrid className="h-3.5 w-3.5" />}
        label="Kanban"
      />
    </div>
  );
}

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function ToggleButton({ active, onClick, icon, label }: ToggleButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-xs font-sans transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
