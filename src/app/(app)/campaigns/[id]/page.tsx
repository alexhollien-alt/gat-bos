import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { StepBuilder } from "@/components/campaigns/step-builder";
import { CampaignSettings } from "@/components/campaigns/campaign-settings";
import { EnrollmentList } from "@/components/campaigns/enrollment-list";
import type { Campaign, CampaignStep, CampaignType, CampaignStatus } from "@/lib/types";

const typeColors: Record<CampaignType, string> = {
  drip: "bg-purple-100 text-purple-700",
  marketing: "bg-sky-100 text-sky-700",
};

const statusColors: Record<CampaignStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  archived: "bg-slate-100 text-slate-500",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!campaign) notFound();

  const { data: steps } = await supabase
    .from("campaign_steps")
    .select("*")
    .eq("campaign_id", id)
    .is("deleted_at", null)
    .order("step_number", { ascending: true });

  const { data: enrollments } = await supabase
    .from("campaign_enrollments")
    .select("*, contacts(first_name, last_name)")
    .eq("campaign_id", id)
    .is("deleted_at", null)
    .order("enrolled_at", { ascending: false });

  const { data: completions } = await supabase
    .from("campaign_step_completions")
    .select("*")
    .in(
      "enrollment_id",
      (enrollments ?? []).map((e: { id: string }) => e.id)
    )
    .is("deleted_at", null);

  const typedCampaign = campaign as Campaign;
  const typedSteps = (steps ?? []) as CampaignStep[];

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 mt-0.5">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-800">
              {typedCampaign.name}
            </h1>
            <Badge
              variant="secondary"
              className={typeColors[typedCampaign.type]}
            >
              {typedCampaign.type}
            </Badge>
            <Badge
              variant="secondary"
              className={statusColors[typedCampaign.status]}
            >
              {typedCampaign.status}
            </Badge>
          </div>
          {typedCampaign.description && (
            <p className="mt-1 text-sm text-slate-500">
              {typedCampaign.description}
            </p>
          )}
          <div className="mt-2 flex gap-4 text-xs text-slate-400">
            <span>{typedCampaign.step_count} steps</span>
            <span>{typedCampaign.enrolled_count} enrolled</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="steps">
        <TabsList>
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="steps" className="mt-4">
          <StepBuilder campaignId={id} steps={typedSteps} />
        </TabsContent>

        <TabsContent value="enrollments" className="mt-4">
          <EnrollmentList
            campaignId={id}
            enrollments={(enrollments ?? []) as Parameters<typeof EnrollmentList>[0]["enrollments"]}
            steps={typedSteps}
            completions={(completions ?? []) as Parameters<typeof EnrollmentList>[0]["completions"]}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <CampaignSettings campaign={typedCampaign} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
