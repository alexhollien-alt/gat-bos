import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Campaign, CampaignType, CampaignStatus } from "@/lib/types";
import { campaignTypeValues, campaignStatusValues } from "@/lib/validations";

const typeColors: Record<CampaignType, string> = {
  drip: "bg-purple-100 text-purple-700",
  marketing: "bg-sky-100 text-sky-700",
};

const statusColors: Record<CampaignStatus, string> = {
  draft: "bg-secondary text-muted-foreground",
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  archived: "bg-secondary text-muted-foreground",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const filterType = campaignTypeValues.includes(
    params.type as (typeof campaignTypeValues)[number]
  )
    ? params.type
    : undefined;
  const filterStatus = campaignStatusValues.includes(
    params.status as (typeof campaignStatusValues)[number]
  )
    ? params.status
    : undefined;

  let query = supabase
    .from("campaigns")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (filterType) query = query.eq("type", filterType);
  if (filterStatus) query = query.eq("status", filterStatus);

  const { data: campaigns } = await query;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground font-display">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {campaigns?.length ?? 0} campaign
            {(campaigns?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button size="sm">New Campaign</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Link href="/campaigns">
          <Badge
            variant="secondary"
            className={
              !filterType && !filterStatus
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }
          >
            All
          </Badge>
        </Link>
        {campaignTypeValues.map((t) => (
          <Link
            key={t}
            href={`/campaigns?type=${t}${filterStatus ? `&status=${filterStatus}` : ""}`}
          >
            <Badge
              variant="secondary"
              className={
                filterType === t
                  ? "bg-foreground text-background"
                  : typeColors[t] + " hover:opacity-80"
              }
            >
              {t}
            </Badge>
          </Link>
        ))}
        <span className="mx-1 border-l border-border" />
        {campaignStatusValues.map((s) => (
          <Link
            key={s}
            href={`/campaigns?status=${s}${filterType ? `&type=${filterType}` : ""}`}
          >
            <Badge
              variant="secondary"
              className={
                filterStatus === s
                  ? "bg-foreground text-background"
                  : statusColors[s] + " hover:opacity-80"
              }
            >
              {s}
            </Badge>
          </Link>
        ))}
      </div>

      {!campaigns || campaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No campaigns yet. Create your first one.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Steps</TableHead>
                <TableHead className="text-right">Enrolled</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(campaigns as Campaign[]).map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {campaign.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={typeColors[campaign.type]}
                    >
                      {campaign.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={statusColors[campaign.status]}
                    >
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {campaign.step_count}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {campaign.enrolled_count}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(campaign.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
