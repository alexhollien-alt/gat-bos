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
import { AccentRule, SectionShell } from "@/components/screen";

const typeColors: Record<CampaignType, string> = {
  drip: "bg-[color:var(--accent-red)]/10 text-[var(--accent-red)] border border-[color:var(--accent-red)]/20",
  marketing: "bg-[color:var(--accent-blue)]/10 text-blue-400 border border-[color:var(--accent-blue)]/20",
};

const statusColors: Record<CampaignStatus, string> = {
  draft: "bg-secondary text-muted-foreground",
  active: "bg-green-500/10 text-green-400 border border-green-500/20",
  paused: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  archived: "bg-secondary text-muted-foreground",
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
    <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0 max-w-3xl mx-0 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 mt-0.5">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-h2-screen sm:text-h1-screen font-display text-foreground leading-[1.1] tracking-headline">
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
            <p className="mt-2 text-small text-muted-foreground max-w-2xl">
              {typedCampaign.description}
            </p>
          )}
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground font-mono">
            <span>{typedCampaign.step_count} steps</span>
            <span>{typedCampaign.enrolled_count} enrolled</span>
          </div>
        </div>
      </div>
      <AccentRule variant="hairline" />

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
    </SectionShell>
  );
}
