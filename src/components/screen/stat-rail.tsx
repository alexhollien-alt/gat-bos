import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface StatRailItem {
  stat: ReactNode;
  label: ReactNode;
}

export type StatRailSize = "sm" | "md" | "lg";

interface StatRailProps {
  items: StatRailItem[];
  size?: StatRailSize;
  divider?: boolean;
  className?: string;
  statClassName?: string;
  labelClassName?: string;
}

const statSizeClasses: Record<StatRailSize, string> = {
  sm: "text-[16px] sm:text-[18px]",
  md: "text-[20px] sm:text-[24px]",
  lg: "text-[28px] sm:text-[32px]",
};

const labelSizeClasses: Record<StatRailSize, string> = {
  sm: "text-[8px]",
  md: "text-[8px] sm:text-[9px]",
  lg: "text-[9px] sm:text-[10px]",
};

export function StatRail({
  items,
  size = "md",
  divider = true,
  className,
  statClassName,
  labelClassName,
}: StatRailProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-8 sm:gap-14",
        divider && "py-5 border-t border-white/[0.06]",
        className,
      )}
    >
      {items.map((item, i) => (
        <div key={i} className="flex items-baseline gap-1.5 text-center">
          <span
            className={cn(
              "font-mono text-white/80 leading-none tracking-[-0.02em]",
              statSizeClasses[size],
              statClassName,
            )}
          >
            {item.stat}
          </span>
          <span
            className={cn(
              "font-mono text-white/30 uppercase tracking-[0.12em] font-medium",
              labelSizeClasses[size],
              labelClassName,
            )}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
