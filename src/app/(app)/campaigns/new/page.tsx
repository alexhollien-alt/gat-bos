import { CampaignForm } from "@/components/campaigns/campaign-form";
import { AccentRule, PageHeader, SectionShell } from "@/components/screen";

export default function NewCampaignPage() {
  return (
    <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0 max-w-lg mx-0">
      <PageHeader
        eyebrow="Campaigns"
        title="New Campaign"
        subhead="Create a drip sequence or marketing campaign. Add steps after creation."
      />
      <AccentRule variant="hairline" className="mt-6 mb-6" />

      <CampaignForm />
    </SectionShell>
  );
}
