"use client";

import { cn } from "@/lib/utils";
import type { ReactNode, ButtonHTMLAttributes } from "react";

export type FilterPillTone = "crimson" | "blue" | "neutral";

const toneClasses: Record<FilterPillTone, { active: string; idle: string }> = {
  crimson: {
    active: "bg-[color:var(--accent-red)]/10 border-[color:var(--accent-red)]/40 text-[var(--accent-red)]",
    idle: "bg-[var(--surface-raised)] border-white/[0.06] text-muted-foreground hover:border-white/[0.12]",
  },
  blue: {
    active: "bg-[color:var(--accent-blue)]/10 border-[color:var(--accent-blue)]/40 text-[var(--accent-blue)]",
    idle: "bg-[var(--surface-raised)] border-white/[0.06] text-muted-foreground hover:border-white/[0.12]",
  },
  neutral: {
    active: "bg-white/[0.08] border-white/[0.14] text-foreground",
    idle: "bg-[var(--surface-raised)] border-white/[0.06] text-muted-foreground hover:border-white/[0.12]",
  },
};

interface FilterPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tone?: FilterPillTone;
  count?: number;
  children: ReactNode;
}

export function FilterPill({
  active = false,
  tone = "crimson",
  count,
  className,
  children,
  ...rest
}: FilterPillProps) {
  const styles = toneClasses[tone];
  return (
    <button
      type="button"
      className={cn(
        "font-mono uppercase text-micro tracking-label font-medium",
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5",
        "transition-colors",
        active ? styles.active : styles.idle,
        className,
      )}
      aria-pressed={active}
      {...rest}
    >
      <span>{children}</span>
      {typeof count === "number" ? (
        <span className="tabular-nums opacity-70">{count}</span>
      ) : null}
    </button>
  );
}
