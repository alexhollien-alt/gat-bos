import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Eyebrow, type EyebrowTone } from "./eyebrow";

export type PageHeaderSize = "md" | "lg";

interface PageHeaderProps {
  eyebrow?: ReactNode;
  eyebrowTone?: EyebrowTone;
  title: ReactNode;
  subhead?: ReactNode;
  right?: ReactNode;
  size?: PageHeaderSize;
  className?: string;
}

const titleSizeClasses: Record<PageHeaderSize, string> = {
  md: "text-h2-screen sm:text-h1-screen",
  lg: "text-h1-screen sm:text-hero-sm",
};

export function PageHeader({
  eyebrow,
  eyebrowTone = "crimson",
  title,
  subhead,
  right,
  size = "md",
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-6 flex-wrap", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <div className="mb-3">
            <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow>
          </div>
        ) : null}
        <h1
          className={cn(
            "font-display text-foreground leading-[1.1] tracking-headline",
            titleSizeClasses[size],
          )}
        >
          {title}
        </h1>
        {subhead ? (
          <p className="mt-2 text-small text-muted-foreground max-w-2xl">{subhead}</p>
        ) : null}
      </div>
      {right ? <div className="flex-shrink-0">{right}</div> : null}
    </div>
  );
}
