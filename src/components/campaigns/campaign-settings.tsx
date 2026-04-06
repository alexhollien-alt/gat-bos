"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  campaignSchema,
  campaignTypeValues,
  campaignStatusValues,
  type CampaignFormData,
} from "@/lib/validations";
import {
  updateCampaign,
  deleteCampaign,
} from "@/app/(app)/campaigns/[id]/actions";
import type { Campaign } from "@/lib/types";

export function CampaignSettings({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: campaign.name,
      description: campaign.description ?? "",
      type: campaign.type,
      status: campaign.status,
    },
  });

  async function onSubmit(data: CampaignFormData) {
    setSaving(true);
    const result = await updateCampaign(campaign.id, data);
    if (result && "error" in result) {
      toast.error("Failed to update campaign");
      setSaving(false);
      return;
    }
    toast.success("Campaign updated");
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Archive this campaign? It can be restored later.")) return;
    setDeleting(true);
    const result = await deleteCampaign(campaign.id);
    if (result && "error" in result) {
      toast.error("Failed to archive campaign");
      setDeleting(false);
      return;
    }
    toast.success("Campaign archived");
    router.push("/campaigns");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input {...register("name")} />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select
            defaultValue={campaign.type}
            onValueChange={(v) =>
              setValue("type", v as CampaignFormData["type"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {campaignTypeValues.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            defaultValue={campaign.status}
            onValueChange={(v) =>
              setValue("status", v as CampaignFormData["status"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {campaignStatusValues.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea {...register("description")} rows={3} />
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-700"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Archiving..." : "Archive Campaign"}
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
