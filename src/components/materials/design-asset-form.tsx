"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  designAssetSchema,
  type DesignAssetFormData,
  designAssetTypeValues,
} from "@/lib/validations";
import { DESIGN_ASSET_TYPE_LABELS } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export function DesignAssetFormModal({
  open,
  onOpenChange,
  contactId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<DesignAssetFormData>({
    resolver: zodResolver(designAssetSchema),
    defaultValues: {
      contact_id: contactId,
      name: "",
      url: "",
      asset_type: "flyer",
      listing_address: "",
    },
  });

  async function onSubmit(data: DesignAssetFormData) {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("design_assets").insert({
      user_id: user!.id,
      contact_id: data.contact_id,
      name: data.name,
      url: data.url,
      asset_type: data.asset_type,
      listing_address: data.listing_address || null,
    });

    setLoading(false);
    if (error) {
      toast.error("Failed to save design asset");
    } else {
      toast.success("Design asset saved");
      reset();
      onOpenChange(false);
      onSuccess?.();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Design Asset</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              placeholder="e.g. 95th Listing Lux Brochure"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Canva URL</Label>
            <Input
              placeholder="https://canva.link/..."
              {...register("url")}
            />
            {errors.url && (
              <p className="text-sm text-red-500">{errors.url.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                defaultValue="flyer"
                onValueChange={(v) =>
                  setValue(
                    "asset_type",
                    v as (typeof designAssetTypeValues)[number]
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {designAssetTypeValues.map((val) => (
                    <SelectItem key={val} value={val}>
                      {DESIGN_ASSET_TYPE_LABELS[val]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Listing Address</Label>
              <Input
                placeholder="Optional"
                {...register("listing_address")}
              />
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
              {loading ? "Saving..." : "Save asset"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
