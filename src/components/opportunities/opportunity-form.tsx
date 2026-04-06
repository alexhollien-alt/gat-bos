"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  opportunitySchema,
  type OpportunityFormData,
} from "@/lib/validations";
import { OPPORTUNITY_STAGE_CONFIG } from "@/lib/constants";
import { Contact, OpportunityStage } from "@/lib/types";
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

export function OpportunityFormModal({
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

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<OpportunityFormData>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      contact_id: contactId || "",
      property_address: "",
      property_city: "",
      property_state: "AZ",
      property_zip: "",
      sale_price: "",
      stage: "prospect",
      escrow_number: "",
      expected_close_date: "",
      notes: "",
    },
  });

  const fetchContacts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .order("first_name", { ascending: true });
    if (data) setContacts(data);
  }, []);

  useEffect(() => {
    if (open && !contactId) fetchContacts();
  }, [open, contactId, fetchContacts]);

  async function onSubmit(data: OpportunityFormData) {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.from("opportunities").insert({
      contact_id: data.contact_id,
      property_address: data.property_address,
      property_city: data.property_city || null,
      property_state: data.property_state || "AZ",
      property_zip: data.property_zip || null,
      sale_price: data.sale_price ? parseFloat(data.sale_price) : null,
      stage: data.stage,
      escrow_number: data.escrow_number || null,
      expected_close_date: data.expected_close_date || null,
      notes: data.notes || null,
    });

    setLoading(false);
    if (error) {
      toast.error("Failed to create opportunity");
    } else {
      toast.success("Opportunity created");
      reset();
      onOpenChange(false);
      onSuccess?.();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Opportunity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!contactId && (
            <div className="space-y-2">
              <Label>Contact</Label>
              <Select
                onValueChange={(v) => setValue("contact_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contact..." />
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
            <Label>Property Address</Label>
            <Input
              placeholder="123 Main St"
              {...register("property_address")}
            />
            {errors.property_address && (
              <p className="text-sm text-red-500">
                {errors.property_address.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>City</Label>
              <Input placeholder="Scottsdale" {...register("property_city")} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input placeholder="AZ" {...register("property_state")} />
            </div>
            <div className="space-y-2">
              <Label>ZIP</Label>
              <Input placeholder="85251" {...register("property_zip")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Sale Price</Label>
              <Input placeholder="450000" {...register("sale_price")} />
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select
                defaultValue="prospect"
                onValueChange={(v) =>
                  setValue("stage", v as OpportunityStage)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OPPORTUNITY_STAGE_CONFIG).map(
                    ([key, val]) => (
                      <SelectItem key={key} value={key}>
                        {val.label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Escrow Number</Label>
              <Input
                placeholder="Optional"
                {...register("escrow_number")}
              />
            </div>
            <div className="space-y-2">
              <Label>Expected Close</Label>
              <Input
                type="date"
                {...register("expected_close_date")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Additional details..."
              rows={2}
              {...register("notes")}
            />
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
              {loading ? "Creating..." : "Create Opportunity"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
