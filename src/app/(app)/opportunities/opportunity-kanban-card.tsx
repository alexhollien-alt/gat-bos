"use client";

import { useSortable } from "@dnd-kit/sortable";
import { Building, DollarSign } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { CSSProperties } from "react";
import { Opportunity } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatPrice(price: number | null): string {
  if (!price) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

interface OpportunityKanbanCardProps {
  opportunity: Opportunity;
  isDragOverlay?: boolean;
}

export function OpportunityKanbanCard({
  opportunity,
  isDragOverlay = false,
}: OpportunityKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: opportunity.id,
    data: { stage: opportunity.stage, type: "card" },
  });

  const style: CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging && !isDragOverlay ? 0.4 : 1,
  };

  const timeInStage = formatDistanceToNow(new Date(opportunity.updated_at), {
    addSuffix: false,
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-lg border border-border bg-card p-3 cursor-grab active:cursor-grabbing",
        "hover:border-foreground/30 transition-colors",
        isDragOverlay && "shadow-xl ring-1 ring-border rotate-1",
      )}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <Building className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <span className="text-sm font-sans font-medium text-foreground leading-tight break-words">
          {opportunity.property_address}
        </span>
      </div>
      {opportunity.contacts && (
        <Link
          href={`/contacts/${opportunity.contact_id}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="block text-xs text-muted-foreground hover:text-foreground hover:underline mb-2 pl-5 truncate"
        >
          {opportunity.contacts.first_name} {opportunity.contacts.last_name}
        </Link>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <div className="flex items-center gap-0.5">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-mono text-foreground">
            {formatPrice(opportunity.sale_price)}
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          {timeInStage}
        </span>
      </div>
    </div>
  );
}
