"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Opportunity, OpportunityStage } from "@/lib/types";
import { OPPORTUNITY_STAGE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { OpportunityKanbanCard } from "./opportunity-kanban-card";

const PIPELINE_STAGES: OpportunityStage[] = [
  "prospect",
  "under_contract",
  "in_escrow",
  "closed",
  "fell_through",
];

const COLUMN_PREFIX = "column-";

interface KanbanColumnProps {
  stage: OpportunityStage;
  items: Opportunity[];
}

function KanbanColumn({ stage, items }: KanbanColumnProps) {
  const config = OPPORTUNITY_STAGE_CONFIG[stage];
  const { setNodeRef, isOver } = useDroppable({
    id: `${COLUMN_PREFIX}${stage}`,
    data: { stage, type: "column" },
  });

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: config.color }}
        />
        <h3 className="text-xs font-sans font-semibold text-foreground uppercase tracking-wider truncate">
          {config.label}
        </h3>
        <span className="text-xs font-mono text-muted-foreground ml-auto">
          {items.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[240px] rounded-lg p-2 space-y-2 transition-colors",
          "bg-muted/20 border border-border/50",
          isOver && "bg-muted/50 border-border",
        )}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6 font-sans">
              Drop here
            </p>
          ) : (
            items.map((opp) => (
              <OpportunityKanbanCard key={opp.id} opportunity={opp} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

interface KanbanViewProps {
  opportunities: Opportunity[];
  onStageChange: (id: string, stage: OpportunityStage) => void;
}

export function KanbanView({ opportunities, onStageChange }: KanbanViewProps) {
  const [items, setItems] = useState<Opportunity[]>(opportunities);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setItems(opportunities);
  }, [opportunities]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const grouped = useMemo(() => {
    const map = new Map<OpportunityStage, Opportunity[]>();
    for (const stage of PIPELINE_STAGES) map.set(stage, []);
    for (const opp of items) {
      const list = map.get(opp.stage);
      if (list) list.push(opp);
    }
    return map;
  }, [items]);

  const activeOpp = activeId
    ? items.find((i) => i.id === activeId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const draggedId = active.id as string;
    const dragged = items.find((i) => i.id === draggedId);
    if (!dragged) return;

    const overId = over.id as string;
    let targetStage: OpportunityStage;
    if (overId.startsWith(COLUMN_PREFIX)) {
      targetStage = overId.slice(COLUMN_PREFIX.length) as OpportunityStage;
    } else {
      const overOpp = items.find((i) => i.id === overId);
      if (!overOpp) return;
      targetStage = overOpp.stage;
    }

    if (dragged.stage === targetStage) return;

    setItems((prev) =>
      prev.map((o) =>
        o.id === draggedId ? { ...o, stage: targetStage } : o,
      ),
    );
    onStageChange(draggedId, targetStage);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {PIPELINE_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            items={grouped.get(stage) ?? []}
          />
        ))}
      </div>
      <DragOverlay>
        {activeOpp ? (
          <OpportunityKanbanCard opportunity={activeOpp} isDragOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
