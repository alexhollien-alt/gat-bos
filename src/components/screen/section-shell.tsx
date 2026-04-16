import { cn } from "@/lib/utils";
import type { ElementType, ReactNode, HTMLAttributes } from "react";

export type SectionShellMaxWidth = "container" | "container-narrow" | "full";
export type SectionShellPadY = "none" | "sm" | "md";

interface SectionShellProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  maxWidth?: SectionShellMaxWidth;
  padY?: SectionShellPadY;
  children: ReactNode;
}

const maxWidthClasses: Record<SectionShellMaxWidth, string> = {
  container: "max-w-container",
  "container-narrow": "max-w-container-narrow",
  full: "",
};

const padYClasses: Record<SectionShellPadY, string> = {
  none: "",
  sm: "py-section-y-sm",
  md: "py-section-y",
};

export function SectionShell({
  as: Component = "section",
  maxWidth = "container",
  padY = "sm",
  className,
  children,
  ...rest
}: SectionShellProps) {
  return (
    <Component
      className={cn(
        "mx-auto w-full px-6 sm:px-8",
        maxWidthClasses[maxWidth],
        padYClasses[padY],
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}
