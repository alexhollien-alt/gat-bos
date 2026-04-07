import { Opportunity, OpportunityStage } from "@/lib/types";
import { OPPORTUNITY_STAGE_CONFIG } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

interface StageSummary {
  stage: OpportunityStage;
  count: number;
  totalValue: number;
}

export function PipelineSnapshotWidget({
  opportunities,
}: {
  opportunities: Opportunity[];
}) {
  const activeStages: OpportunityStage[] = [
    "prospect",
    "under_contract",
    "in_escrow",
  ];

  const summaries: StageSummary[] = activeStages.map((stage) => {
    const matching = opportunities.filter((o) => o.stage === stage);
    return {
      stage,
      count: matching.length,
      totalValue: matching.reduce((sum, o) => sum + (o.sale_price || 0), 0),
    };
  });

  const closedThisMonth = opportunities.filter((o) => {
    if (o.stage !== "closed" || !o.closed_at) return false;
    const closed = new Date(o.closed_at);
    const now = new Date();
    return (
      closed.getMonth() === now.getMonth() &&
      closed.getFullYear() === now.getFullYear()
    );
  });
  const closedValue = closedThisMonth.reduce(
    (sum, o) => sum + (o.sale_price || 0),
    0
  );

  const totalActive = summaries.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Pipeline
          {totalActive > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              {totalActive} active
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No opportunities yet</p>
        ) : (
          <div className="space-y-3">
            {summaries.map(({ stage, count, totalValue }) => {
              const config = OPPORTUNITY_STAGE_CONFIG[stage];
              return (
                <div key={stage} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="text-sm text-foreground">
                      {config.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground">{count}</span>
                    {totalValue > 0 && (
                      <span
                        className={cn(
                          "text-xs font-mono font-medium px-1.5 py-0.5 rounded",
                          config.bgColor,
                          config.textColor
                        )}
                      >
                        {formatCurrency(totalValue)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {closedThisMonth.length > 0 && (
              <>
                <div className="border-t border-border pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Closed this month
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground">
                        {closedThisMonth.length}
                      </span>
                      <span className="text-xs font-mono font-semibold text-green-400">
                        {formatCurrency(closedValue)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
