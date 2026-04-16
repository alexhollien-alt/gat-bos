import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

export type AccentRuleVariant = "primary" | "hairline" | "gradient-fade";

interface AccentRuleProps {
  variant?: AccentRuleVariant;
  className?: string;
  style?: CSSProperties;
}

export function AccentRule({ variant = "primary", className, style }: AccentRuleProps) {
  if (variant === "hairline") {
    return <div className={cn("h-px w-full bg-white/[0.08]", className)} style={style} />;
  }
  if (variant === "gradient-fade") {
    return (
      <div
        className={cn(
          "h-px w-full bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent",
          className,
        )}
        style={style}
      />
    );
  }
  return (
    <div
      className={cn("h-[3px] w-full", className)}
      style={{
        background: "linear-gradient(90deg, var(--accent-red) 0%, var(--accent-red) 30%, var(--accent-blue) 100%)",
        ...style,
      }}
    />
  );
}
