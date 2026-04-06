"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addStep, updateStep } from "@/app/(app)/campaigns/[id]/actions";
import type { CampaignStep, StepType } from "@/lib/types";

const stepTypeOptions: { value: StepType; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "call", label: "Call" },
  { value: "text", label: "Text" },
  { value: "mail", label: "Mail" },
  { value: "social", label: "Social" },
  { value: "task", label: "Task" },
];

const formSchema = z.object({
  step_type: z.enum(["email", "call", "text", "mail", "social", "task"]),
  title: z.string().min(1, "Title is required"),
  content: z.string().optional(),
  delay_days: z.number().int().min(0),
  email_subject: z.string().optional(),
  email_body_html: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function StepFormDialog({
  open,
  onOpenChange,
  campaignId,
  nextStepNumber,
  editingStep,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  nextStepNumber: number;
  editingStep?: CampaignStep | null;
  onSuccess: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const isEditing = !!editingStep;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: editingStep
      ? {
          step_type: editingStep.step_type,
          title: editingStep.title,
          content: editingStep.content ?? "",
          delay_days: editingStep.delay_days,
          email_subject: editingStep.email_subject ?? "",
          email_body_html: editingStep.email_body_html ?? "",
        }
      : {
          step_type: "email",
          title: "",
          content: "",
          delay_days: 0,
          email_subject: "",
          email_body_html: "",
        },
  });

  const stepType = watch("step_type");
  const isEmail = stepType === "email";

  async function onSubmit(data: FormData) {
    setSaving(true);

    let result;
    if (isEditing && editingStep) {
      result = await updateStep(editingStep.id, campaignId, data);
    } else {
      result = await addStep({
        ...data,
        campaign_id: campaignId,
        step_number: nextStepNumber,
      });
    }

    if (result && "error" in result) {
      toast.error(isEditing ? "Failed to update step" : "Failed to add step");
      setSaving(false);
      return;
    }

    toast.success(isEditing ? "Step updated" : "Step added");
    reset();
    onOpenChange(false);
    onSuccess();
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Step" : `Add Step ${nextStepNumber}`}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                defaultValue={editingStep?.step_type ?? "email"}
                onValueChange={(v) => setValue("step_type", v as StepType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stepTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Delay (days)</Label>
              <Input
                type="number"
                min={0}
                {...register("delay_days", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input {...register("title")} placeholder="Step title" />
            {errors.title && (
              <p className="text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Instructions / Content</Label>
            <Textarea
              {...register("content")}
              placeholder="What to do in this step..."
              rows={2}
            />
          </div>

          {isEmail && (
            <>
              <div className="space-y-1.5">
                <Label>Email Subject</Label>
                <Input
                  {...register("email_subject")}
                  placeholder="Subject line"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email Body (HTML)</Label>
                <Textarea
                  {...register("email_body_html")}
                  placeholder="<p>Hello {{first_name}},</p>"
                  rows={4}
                  className="font-mono text-xs"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving
                ? "Saving..."
                : isEditing
                  ? "Update Step"
                  : "Add Step"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
