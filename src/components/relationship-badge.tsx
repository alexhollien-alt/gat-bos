import { RELATIONSHIP_CONFIG } from "@/lib/constants";
import { RelationshipStrength } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RelationshipBadge({
  relationship,
  className,
}: {
  relationship: RelationshipStrength;
  className?: string;
}) {
  const config = RELATIONSHIP_CONFIG[relationship] ?? {
    label: relationship,
    bgColor: "bg-gray-100",
    textColor: "text-gray-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        config.bgColor,
        config.textColor,
        className
      )}
    >
      {config.label}
    </span>
  );
}
