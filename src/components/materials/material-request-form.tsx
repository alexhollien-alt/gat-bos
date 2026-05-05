"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  materialRequestSchema,
  type MaterialRequestFormData,
  materialRequestTypeValues,
  materialRequestPriorityValues,
  productTypeValues,
} from "@/lib/validations";
import {
  REQUEST_TYPE_CONFIG,
  REQUEST_PRIORITY_CONFIG,
  PRODUCT_TYPE_CONFIG,
} from "@/lib/constants";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function MaterialRequestFormModal({
  open,
  onOpenChange,
  contactId,
  contactName,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName?: string;
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<MaterialRequestFormData>({
    resolver: zodResolver(materialRequestSchema),
    defaultValues: {
      contact_id: contactId,
      title: "",
      request_type: "print_ready",
      priority: "standard",
      notes: "",
      items: [{ product_type: "flyer", quantity: 25, design_url: "", description: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  async function onSubmit(data: MaterialRequestFormData) {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Insert request header
    const { data: request, error: reqError } = await supabase
      .from("material_requests")
      .insert({
        user_id: user!.id,
        contact_id: data.contact_id,
        title: data.title,
        request_type: data.request_type,
        priority: data.priority,
        notes: data.notes || null,
        status: "draft",
      })
      .select("id")
      .single();

    if (reqError || !request) {
      setLoading(false);
      toast.error("Failed to create request");
      return;
    }

    // Insert line items
    const items = data.items.map((item) => ({
      request_id: request.id,
      product_type: item.product_type,
      quantity: item.quantity,
      design_url: item.design_url || null,
      description: item.description || null,
    }));

    const { error: itemsError } = await supabase
      .from("material_request_items")
      .insert(items);

    setLoading(false);
    if (itemsError) {
      toast.error("Request created but items failed to save");
    } else {
      toast.success("Material request created");
      reset();
      onOpenChange(false);
      onSuccess?.();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            New Material Request
            {contactName && (
              <span className="text-sm font-normal text-slate-500 ml-2">
                for {contactName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="e.g. Chase Reynolds - 95th Listing Brochure"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Request Type</Label>
              <Select
                defaultValue="print_ready"
                onValueChange={(v) =>
                  setValue(
                    "request_type",
                    v as (typeof materialRequestTypeValues)[number]
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {materialRequestTypeValues.map((val) => (
                    <SelectItem key={val} value={val}>
                      {REQUEST_TYPE_CONFIG[val].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                defaultValue="standard"
                onValueChange={(v) =>
                  setValue(
                    "priority",
                    v as (typeof materialRequestPriorityValues)[number]
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {materialRequestPriorityValues.map((val) => (
                    <SelectItem key={val} value={val}>
                      {REQUEST_PRIORITY_CONFIG[val].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    product_type: "flyer",
                    quantity: 25,
                    design_url: "",
                    description: "",
                  })
                }
              >
                <Plus className="h-3 w-3 mr-1" />
                Add item
              </Button>
            </div>
            {errors.items?.message && (
              <p className="text-sm text-red-500">{errors.items.message}</p>
            )}
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="p-3 border border-slate-200 rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Item {index + 1}
                  </span>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Product</Label>
                    <Select
                      defaultValue={field.product_type}
                      onValueChange={(v) =>
                        setValue(
                          `items.${index}.product_type`,
                          v as (typeof productTypeValues)[number]
                        )
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {productTypeValues.map((val) => (
                          <SelectItem key={val} value={val}>
                            {PRODUCT_TYPE_CONFIG[val].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min={1}
                      className="h-8 text-xs"
                      {...register(`items.${index}.quantity`, {
                        valueAsNumber: true,
                      })}
                    />
                    {errors.items?.[index]?.quantity && (
                      <p className="text-xs text-red-500">
                        {errors.items[index].quantity?.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Design URL (Canva link)</Label>
                  <Input
                    placeholder="https://canva.link/..."
                    className="h-8 text-xs"
                    {...register(`items.${index}.design_url`)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Input
                    placeholder="Special instructions for this item..."
                    className="h-8 text-xs"
                    {...register(`items.${index}.description`)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Notes to Production</Label>
            <Textarea
              placeholder="General instructions, shipping preferences..."
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
              {loading ? "Creating..." : "Create request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
