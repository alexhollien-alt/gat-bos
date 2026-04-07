import { CampaignForm } from "@/components/campaigns/campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground font-display">New Campaign</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a drip sequence or marketing campaign. Add steps after
          creation.
        </p>
      </div>

      <CampaignForm />
    </div>
  );
}
