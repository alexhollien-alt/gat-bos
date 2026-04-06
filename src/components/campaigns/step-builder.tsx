"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Phone,
  MessageSquare,
  Package,
  Share2,
  CheckSquare,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StepFormDialog } from "./step-form";
import { deleteStep, reorderSteps } from "@/app/(app)/campaigns/[id]/actions";
import type { CampaignStep, StepType } from "@/lib/types";

const stepTypeIcons: Record<StepType, typeof Mail> = {
  email: Mail,
  call: Phone,
  text: MessageSquare,
  mail: Package,
  social: Share2,
  task: CheckSquare,
};

const stepTypeColors: Record<StepType, string> = {
  email: "bg-blue-50 text-blue-600",
  call: "bg-green-50 text-green-600",
  text: "bg-purple-50 text-purple-600",
  mail: "bg-amber-50 text-amber-600",
  social: "bg-pink-50 text-pink-600",
  task: "bg-slate-100 text-slate-600",
};

export function StepBuilder({
  campaignId,
  steps: initialSteps,
}: {
  campaignId: string;
  steps: CampaignStep[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingStep, setEditingStep] = useState<CampaignStep | null>(null);
  const steps = initialSteps;

  function handleRefresh() {
    router.refresh();
  }

  async function handleDelete(step: CampaignStep) {
    const result = await deleteStep(step.id, campaignId);
    if (result && "error" in result) {
      toast.error("Failed to delete step");
      return;
    }
    toast.success("Step deleted");
    handleRefresh();
  }

  async function handleMove(index: number, direction: "up" | "down") {
    const newSteps = [...steps];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newSteps.length) return;

    [newSteps[index], newSteps[swapIndex]] = [
      newSteps[swapIndex],
      newSteps[index],
    ];

    const stepIds = newSteps.map((s) => s.id);
    const result = await reorderSteps(campaignId, stepIds);
    if (result && "error" in result) {
      toast.error("Failed to reorder");
      return;
    }
    handleRefresh();
  }

  function handleEdit(step: CampaignStep) {
    setEditingStep(step);
    setShowForm(true);
  }

  return (
    <div className="space-y-3">
      {steps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-400">
            No steps yet. Add your first step to build the sequence.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step, i) => {
            const Icon = stepTypeIcons[step.step_type] ?? CheckSquare;
            return (
              <div
                key={step.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                    stepTypeColors[step.step_type]
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">
                      {step.step_number}.
                    </span>
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {step.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-400 capitalize">
                      {step.step_type}
                    </span>
                    {step.delay_days > 0 && (
                      <span className="text-xs text-slate-400">
                        +{step.delay_days}d delay
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleMove(i, "up")}
                    disabled={i === 0}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleMove(i, "down")}
                    disabled={i === steps.length - 1}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleEdit(step)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                    onClick={() => handleDelete(step)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setEditingStep(null);
          setShowForm(true);
        }}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add Step
      </Button>

      <StepFormDialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditingStep(null);
        }}
        campaignId={campaignId}
        nextStepNumber={steps.length + 1}
        editingStep={editingStep}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
