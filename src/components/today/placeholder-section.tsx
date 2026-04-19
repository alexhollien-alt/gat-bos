"use client";

import { Mail, Calendar, LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  mail: Mail,
  calendar: Calendar,
};

interface PlaceholderSectionProps {
  title: string;
  description: string;
  icon: keyof typeof iconMap;
}

export function PlaceholderSection({
  title,
  description,
  icon,
}: PlaceholderSectionProps) {
  const Icon = iconMap[icon] ?? Mail;

  return (
    <section role="region" aria-label={title}>
      <div className="flex items-center gap-3 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h2>
      </div>
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </section>
  );
}
