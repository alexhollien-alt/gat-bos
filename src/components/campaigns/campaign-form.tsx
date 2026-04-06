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
  type CampaignFormData,
} from "@/lib/validations";
import { createCampaign } from "@/app/(app)/campaigns/actions";

export function CampaignForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      type: "drip",
      status: "draft",
    },
  });

  async function onSubmit(data: CampaignFormData) {
    setSaving(true);
    const result = await createCampaign(data);

    if (result && "error" in result) {
      const msg = typeof result.error === "object" && "_form" in (result.error as Record<string, unknown>)
        ? (result.error as Record<string, string[]>)._form?.[0]
        : JSON.stringify(result.error);
      toast.error(msg || "Failed to create campaign");
      setSaving(false);
      return;
    }

    toast.success("Campaign created");
    if (result && "id" in result) {
      router.push(`/campaigns/${result.id}`);
    } else {
      router.push("/campaigns");
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input
            {...register("name")}
            placeholder="New Agent Onboarding"
          />
          {errors.name && (
            <p className="text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select
            defaultValue="drip"
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
          <Label>Description</Label>
          <Textarea
            {...register("description")}
            placeholder="Describe the purpose and goals of this campaign..."
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Creating..." : "Create Campaign"}
        </Button>
      </div>
    </form>
  );
}
