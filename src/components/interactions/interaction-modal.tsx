"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  interactionSchema,
  type InteractionFormData,
} from "@/lib/validations";
import { INTERACTION_CONFIG } from "@/lib/constants";
import { InteractionType } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { VoiceInput } from "@/components/ui/voice-input";
import { toast } from "sonner";

export function InteractionModal({
  open,
  onOpenChange,
  contactId,
  contactName,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string;
  contactName?: string;
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<InteractionFormData>({
    resolver: zodResolver(interactionSchema),
    defaultValues: {
      contact_id: contactId || "",
      type: "call",
      summary: "",
      occurred_at: new Date().toISOString().slice(0, 16),
    },
  });

  function appendSummary(text: string) {
    const current = watch("summary") || "";
    const next = current.trim() ? `${current.trim()} ${text}` : text;
    setValue("summary", next, { shouldValidate: true });
  }

  async function onSubmit(data: InteractionFormData) {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("interactions").insert({
      user_id: user!.id,
      contact_id: data.contact_id,
      type: data.type,
      summary: data.summary,
      occurred_at: new Date(data.occurred_at).toISOString(),
    });

    setLoading(false);
    if (error) {
      toast.error("Failed to log interaction");
    } else {
      toast.success("Interaction logged");
      reset();
      onOpenChange(false);
      onSuccess?.();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Log Interaction
            {contactName && (
              <span className="text-slate-400 font-normal">
                {" "}
                with {contactName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!contactId && (
            <div className="space-y-2">
              <Label>Contact ID</Label>
              <Input
                placeholder="Contact UUID"
                {...register("contact_id")}
              />
              {errors.contact_id && (
                <p className="text-sm text-red-500">
                  {errors.contact_id.message}
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              defaultValue="call"
              onValueChange={(v) =>
                setValue("type", v as InteractionType)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INTERACTION_CONFIG).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    {val.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>When</Label>
            <Input
              type="datetime-local"
              {...register("occurred_at")}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Summary</Label>
              <VoiceInput onTranscript={appendSummary} label="Dictate" />
            </div>
            <Textarea
              placeholder="What happened?"
              rows={3}
              {...register("summary")}
            />
            {errors.summary && (
              <p className="text-sm text-red-500">{errors.summary.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Log interaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
