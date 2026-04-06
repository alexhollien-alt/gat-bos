"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Mail,
  Phone,
  MessageSquare,
  Package,
  Share2,
  CheckSquare,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { completeStep } from "@/app/(app)/campaigns/[id]/actions";
import type { CampaignStep, StepType, EnrollmentStatus } from "@/lib/types";

const stepTypeIcons: Record<StepType, typeof Mail> = {
  email: Mail,
  call: Phone,
  text: MessageSquare,
  mail: Package,
  social: Share2,
  task: CheckSquare,
};

type CompletionRow = {
  id: string;
  step_id: string;
  completed_at: string;
  notes: string | null;
};

export function EnrollmentProgress({
  enrollmentId,
  campaignId,
  currentStep,
  enrollmentStatus,
  steps,
  completions,
  onRefresh,
}: {
  enrollmentId: string;
  campaignId: string;
  currentStep: number;
  enrollmentStatus: EnrollmentStatus;
  steps: CampaignStep[];
  completions: CompletionRow[];
  onRefresh: () => void;
}) {
  const [completingStepId, setCompletingStepId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const completedStepIds = new Set(completions.map((c) => c.step_id));

  async function handleComplete(step: CampaignStep) {
    setCompletingStepId(step.id);
    const result = await completeStep(enrollmentId, step.id, campaignId, notes || undefined);
    if (result && "error" in result) {
      toast.error("Failed to complete step");
      setCompletingStepId(null);
      return;
    }
    toast.success(`Completed: ${step.title}`);
    setNotes("");
    setCompletingStepId(null);
    onRefresh();
  }

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{
              width: `${steps.length > 0 ? (completions.length / steps.length) * 100 : 0}%`,
            }}
          />
        </div>
        <span className="text-xs text-slate-400 shrink-0">
          {completions.length}/{steps.length}
        </span>
      </div>

      {steps.map((step) => {
        const isCompleted = completedStepIds.has(step.id);
        const isCurrent = step.step_number === currentStep && enrollmentStatus === "active";
        const completion = completions.find((c) => c.step_id === step.id);
        const Icon = stepTypeIcons[step.step_type] ?? CheckSquare;

        return (
          <div
            key={step.id}
            className={cn(
              "flex items-start gap-2 rounded-md px-2 py-1.5",
              isCurrent && "bg-blue-50",
              isCompleted && "opacity-60"
            )}
          >
            <div className="mt-0.5">
              {isCompleted ? (
                <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" />
                </div>
              ) : (
                <div className="h-5 w-5 rounded-full border border-slate-300 flex items-center justify-center">
                  <Icon className="h-3 w-3 text-slate-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700">
                  {step.title}
                </span>
                {step.delay_days > 0 && (
                  <span className="text-xs text-slate-400">
                    +{step.delay_days}d
                  </span>
                )}
              </div>
              {isCompleted && completion?.notes && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {completion.notes}
                </p>
              )}
              {isCurrent && !isCompleted && (
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    placeholder="Notes (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-7 text-xs flex-1"
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={completingStepId === step.id}
                    onClick={() => handleComplete(step)}
                  >
                    {completingStepId === step.id ? "..." : "Complete"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
