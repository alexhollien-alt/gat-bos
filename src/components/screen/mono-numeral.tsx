import { cn } from "@/lib/utils";
import type { ReactNode, HTMLAttributes } from "react";

export type MonoNumeralSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<MonoNumeralSize, string> = {
  xs: "text-[10px]",
  sm: "text-[12px]",
  md: "text-[16px]",
  lg: "text-[20px] sm:text-[24px]",
  xl: "text-[28px] sm:text-[32px]",
};

interface MonoNumeralProps extends HTMLAttributes<HTMLSpanElement> {
  size?: MonoNumeralSize;
  children: ReactNode;
}

export function MonoNumeral({ size = "md", className, children, ...rest }: MonoNumeralProps) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums tracking-[-0.02em] leading-none",
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
