"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { followUpSchema, type FollowUpFormData } from "@/lib/validations";
import { Contact } from "@/lib/types";
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

export function FollowUpFormModal({
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
  const [contacts, setContacts] = useState<
    Pick<Contact, "id" | "first_name" | "last_name">[]
  >([]);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FollowUpFormData>({
    resolver: zodResolver(followUpSchema),
    defaultValues: {
      contact_id: contactId || "",
      reason: "",
      due_date: "",
    },
  });

  useEffect(() => {
    if (!contactId) {
      supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .order("last_name")
        .then(({ data }) => {
          if (data) setContacts(data);
        });
    }
  }, [contactId]);

  async function onSubmit(data: FollowUpFormData) {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("follow_ups").insert({
      user_id: user!.id,
      contact_id: data.contact_id,
      reason: data.reason,
      due_date: data.due_date,
    });

    setLoading(false);
    if (error) {
      toast.error("Failed to create follow-up");
    } else {
      toast.success("Follow-up scheduled");
      reset();
      onOpenChange(false);
      onSuccess?.();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Follow-up</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!contactId && (
            <div className="space-y-2">
              <Label>Contact</Label>
              <Select
                onValueChange={(v) => setValue("contact_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.contact_id && (
                <p className="text-sm text-red-500">
                  {errors.contact_id.message}
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input type="date" {...register("due_date")} />
            {errors.due_date && (
              <p className="text-sm text-red-500">{errors.due_date.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              placeholder="Why should you follow up?"
              rows={2}
              {...register("reason")}
            />
            {errors.reason && (
              <p className="text-sm text-red-500">{errors.reason.message}</p>
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
              {loading ? "Scheduling..." : "Schedule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
