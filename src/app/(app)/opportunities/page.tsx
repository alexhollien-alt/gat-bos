"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Opportunity, OpportunityStage } from "@/lib/types";
import { OPPORTUNITY_STAGE_CONFIG } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Building, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";
import { OpportunityFormModal } from "@/components/opportunities/opportunity-form";
import { AccentRule, MonoNumeral, PageHeader, SectionShell } from "@/components/screen";
import { KanbanView } from "./kanban-view";
import { ViewToggle, useOpportunityView } from "./view-toggle";

function formatPrice(price: number | null): string {
  if (!price) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

const PIPELINE_STAGES: OpportunityStage[] = [
  "prospect",
  "under_contract",
  "in_escrow",
  "closed",
  "fell_through",
];

export default function OpportunitiesPage() {
  const supabase = createClient();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useOpportunityView();

  const fetchOpportunities = useCallback(async () => {
    const { data } = await supabase
      .from("opportunities")
      .select("*, contacts(id, first_name, last_name)")
      .order("created_at", { ascending: false });
    if (data) setOpportunities(data);
  }, []);

  useEffect(() => {
    fetchOpportunities();
    const onFocus = () => fetchOpportunities();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchOpportunities]);

  async function updateStage(id: string, stage: OpportunityStage) {
    const updates: Record<string, unknown> = { stage };
    if (stage === "closed") updates.closed_at = new Date().toISOString();
    const { error } = await supabase
      .from("opportunities")
      .update(updates)
      .eq("id", id);
    if (error) {
      toast.error("Failed to update stage");
    } else {
      fetchOpportunities();
    }
  }

  const grouped = PIPELINE_STAGES.map((stage) => ({
    stage,
    config: OPPORTUNITY_STAGE_CONFIG[stage],
    items: opportunities.filter((o) => o.stage === stage),
    total: opportunities
      .filter((o) => o.stage === stage)
      .reduce((sum, o) => sum + (o.sale_price || 0), 0),
  }));

  return (
    <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0 max-w-6xl mx-0">
      <PageHeader
        eyebrow="Deal flow"
        title="Pipeline"
        subhead={`${opportunities.length} opportunit${opportunities.length === 1 ? "y" : "ies"}`}
        right={
          <div className="flex items-center gap-2">
            <ViewToggle mode={viewMode} onModeChange={setViewMode} />
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Opportunity
            </Button>
          </div>
        }
      />
      <AccentRule variant="hairline" className="mt-6 mb-6" />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(["prospect", "under_contract", "in_escrow"] as OpportunityStage[]).map(
          (stage) => {
            const g = grouped.find((g) => g.stage === stage)!;
            return (
              <Card key={stage}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: g.config.color }}
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                      {g.config.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <MonoNumeral size="lg" className="text-foreground font-semibold">
                      {g.items.length}
                    </MonoNumeral>
                    {g.total > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {formatPrice(g.total)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          }
        )}
      </div>

      {/* Pipeline columns */}
      {viewMode === "kanban" ? (
        <KanbanView opportunities={opportunities} onStageChange={updateStage} />
      ) : (
      <div className="space-y-6">
        {grouped.map(({ stage, config, items, total }) => (
          <div key={stage}>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <h2 className="text-sm font-semibold text-foreground">
                {config.label}
              </h2>
              <span className="text-xs text-muted-foreground">
                {items.length}
                {total > 0 && ` -- ${formatPrice(total)}`}
              </span>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 pl-5">
                No opportunities in this stage
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((opp) => (
                  <div
                    key={opp.id}
                    id={`opp-${opp.id}`}
                    className="bg-card border border-border rounded-lg p-4 flex items-center gap-4 scroll-mt-24 target:ring-2 target:ring-primary/40"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Building className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground truncate">
                          {opp.property_address}
                        </span>
                        {opp.property_city && (
                          <span className="text-xs text-muted-foreground">
                            {opp.property_city}, {opp.property_state}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {opp.contacts && (
                          <Link
                            href={`/contacts/${opp.contact_id}`}
                            className="hover:text-foreground hover:underline"
                          >
                            {opp.contacts.first_name} {opp.contacts.last_name}
                          </Link>
                        )}
                        {opp.escrow_number && (
                          <span>Escrow #{opp.escrow_number}</span>
                        )}
                        {opp.expected_close_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Close:{" "}
                            {format(
                              new Date(opp.expected_close_date),
                              "MMM d, yyyy"
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {opp.sale_price && (
                      <div className="flex items-center gap-1 shrink-0">
                        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-semibold text-foreground">
                          {formatPrice(opp.sale_price)}
                        </span>
                      </div>
                    )}

                    <Select
                      value={opp.stage}
                      onValueChange={(v) =>
                        updateStage(opp.id, v as OpportunityStage)
                      }
                    >
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PIPELINE_STAGES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {OPPORTUNITY_STAGE_CONFIG[s].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      )}

      <OpportunityFormModal
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={fetchOpportunities}
      />
    </SectionShell>
  );
}
