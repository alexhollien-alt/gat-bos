import { Tag } from "@/lib/types";
import { X } from "lucide-react";

export function TagChip({
  tag,
  onRemove,
}: {
  tag: Tag;
  onRemove?: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: tag.color }}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:opacity-80 transition-opacity"
          type="button"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
