"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { taskSchema, type TaskFormData } from "@/lib/validations";
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
import { toast } from "sonner";

export function TaskFormModal({
  open,
  onOpenChange,
  contactId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string;
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      contact_id: contactId || "",
      title: "",
      description: "",
      due_date: "",
      priority: "medium",
    },
  });

  async function onSubmit(data: TaskFormData) {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("tasks").insert({
      user_id: user!.id,
      contact_id: data.contact_id || null,
      title: data.title,
      description: data.description || null,
      due_date: data.due_date || null,
      priority: data.priority,
    });

    setLoading(false);
    if (error) {
      toast.error("Failed to create task");
    } else {
      toast.success("Task created");
      reset();
      onOpenChange(false);
      onSuccess?.();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input placeholder="What needs to be done?" {...register("title")} />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Details..."
              rows={2}
              {...register("description")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" {...register("due_date")} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                defaultValue="medium"
                onValueChange={(v) =>
                  setValue("priority", v as "low" | "medium" | "high")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              {loading ? "Creating..." : "Create task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
