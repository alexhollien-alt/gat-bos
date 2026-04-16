import { cn } from "@/lib/utils";
import type { ReactNode, HTMLAttributes } from "react";

export type EyebrowTone = "crimson" | "blue" | "muted" | "inherit";

const toneClasses: Record<EyebrowTone, string> = {
  crimson: "text-[var(--accent-red)]",
  blue: "text-[var(--accent-blue)]",
  muted: "text-muted-foreground",
  inherit: "",
};

interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: EyebrowTone;
  children: ReactNode;
}

export function Eyebrow({ tone = "crimson", className, children, ...rest }: EyebrowProps) {
  return (
    <span
      className={cn(
        "font-mono uppercase text-eyebrow tracking-eyebrow font-semibold",
        toneClasses[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
