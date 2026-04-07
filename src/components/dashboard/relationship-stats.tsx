import { RelationshipStrength } from "@/lib/types";
import { RELATIONSHIP_CONFIG } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function RelationshipStatsWidget({
  stats,
}: {
  stats: Record<RelationshipStrength, number>;
}) {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Relationships
          <span className="text-xs text-muted-foreground font-normal">
            <span className="font-mono">{total}</span> contacts
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {(Object.entries(RELATIONSHIP_CONFIG) as [RelationshipStrength, typeof RELATIONSHIP_CONFIG[RelationshipStrength]][]).map(
            ([key, config]) => {
              const count = stats[key] || 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-xs font-medium w-28",
                      config.textColor
                    )}
                  >
                    {config.label}
                  </span>
                  <div className="flex-1 bg-secondary rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: config.color,
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground w-6 text-right">
                    {count}
                  </span>
                </div>
              );
            }
          )}
        </div>
      </CardContent>
    </Card>
  );
}
