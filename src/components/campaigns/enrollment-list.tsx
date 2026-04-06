"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Pause,
  Play,
  X,
  CheckCircle2,
} from "lucide-react";
import { EnrollDialog } from "./enroll-dialog";
import { EnrollmentProgress } from "./enrollment-progress";
import {
  removeEnrollment,
  pauseEnrollment,
  resumeEnrollment,
} from "@/app/(app)/campaigns/[id]/actions";
import type { CampaignStep, EnrollmentStatus } from "@/lib/types";

type EnrollmentRow = {
  id: string;
  campaign_id: string;
  contact_id: string;
  status: EnrollmentStatus;
  current_step: number;
  enrolled_at: string;
  completed_at: string | null;
  contacts: { first_name: string; last_name: string } | null;
};

type CompletionRow = {
  id: string;
  enrollment_id: string;
  step_id: string;
  completed_at: string;
  notes: string | null;
};

const statusColors: Record<EnrollmentStatus, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  paused: "bg-amber-100 text-amber-700",
  removed: "bg-slate-100 text-slate-500",
};

export function EnrollmentList({
  campaignId,
  enrollments,
  steps,
  completions,
}: {
  campaignId: string;
  enrollments: EnrollmentRow[];
  steps: CampaignStep[];
  completions: CompletionRow[];
}) {
  const router = useRouter();
  const [showEnroll, setShowEnroll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeEnrollments = enrollments.filter((e) => e.status !== "removed");
  const enrolledContactIds = activeEnrollments.map((e) => e.contact_id);

  function handleRefresh() {
    router.refresh();
  }

  async function handleRemove(enrollment: EnrollmentRow) {
    if (!confirm("Remove this contact from the campaign?")) return;
    const result = await removeEnrollment(enrollment.id, campaignId);
    if (result && "error" in result) {
      toast.error("Failed to remove");
      return;
    }
    toast.success("Contact removed");
    handleRefresh();
  }

  async function handlePause(enrollment: EnrollmentRow) {
    await pauseEnrollment(enrollment.id, campaignId);
    toast.success("Enrollment paused");
    handleRefresh();
  }

  async function handleResume(enrollment: EnrollmentRow) {
    await resumeEnrollment(enrollment.id, campaignId);
    toast.success("Enrollment resumed");
    handleRefresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          {activeEnrollments.length} enrolled
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowEnroll(true)}>
          <UserPlus className="h-3.5 w-3.5 mr-1" />
          Enroll Contact
        </Button>
      </div>

      {activeEnrollments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-400">
            No contacts enrolled yet. Click &ldquo;Enroll Contact&rdquo; to add contacts to
            this campaign.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeEnrollments.map((enrollment) => {
            const isExpanded = expandedId === enrollment.id;
            const enrollmentCompletions = completions.filter(
              (c) => c.enrollment_id === enrollment.id
            );

            return (
              <div
                key={enrollment.id}
                className="rounded-lg border border-slate-200 bg-white"
              >
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : enrollment.id)
                  }
                >
                  {enrollment.status === "completed" && (
                    <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-800">
                      {enrollment.contacts
                        ? `${enrollment.contacts.first_name} ${enrollment.contacts.last_name}`
                        : "Unknown"}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="secondary"
                        className={statusColors[enrollment.status] + " text-xs"}
                      >
                        {enrollment.status}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        Step {enrollment.current_step} of {steps.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {enrollment.status === "active" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePause(enrollment);
                        }}
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {enrollment.status === "paused" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResume(enrollment);
                        }}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {enrollment.status !== "completed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(enrollment);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 p-3">
                    <EnrollmentProgress
                      enrollmentId={enrollment.id}
                      campaignId={campaignId}
                      currentStep={enrollment.current_step}
                      enrollmentStatus={enrollment.status}
                      steps={steps}
                      completions={enrollmentCompletions}
                      onRefresh={handleRefresh}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <EnrollDialog
        open={showEnroll}
        onOpenChange={setShowEnroll}
        campaignId={campaignId}
        enrolledContactIds={enrolledContactIds}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
