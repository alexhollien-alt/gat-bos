import { Contact } from "@/lib/types";
import { TIER_CONFIG } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Thermometer } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict, parseISO } from "date-fns";

function tempColor(temp: number): string {
  if (temp >= 80) return "#ef4444";
  if (temp >= 60) return "#f97316";
  if (temp >= 40) return "#eab308";
  if (temp >= 20) return "#3b82f6";
  return "#6b7280";
}

function touchLabel(date: string | null): string {
  if (!date) return "No touch";
  return formatDistanceToNowStrict(parseISO(date), { addSuffix: true });
}

export function TemperatureLeadersWidget({
  contacts,
}: {
  contacts: Contact[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Thermometer className="h-4 w-4" />
          Hottest Contacts
          {contacts.length > 0 && (
            <span className="ml-auto font-mono text-xs bg-secondary text-foreground px-1.5 py-0.5 rounded">
              {contacts.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No temperature data yet</p>
        ) : (
          <div className="space-y-1">
            {contacts.map((c) => (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="flex items-center gap-3 p-3 rounded-md hover:bg-secondary transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {c.first_name} {c.last_name}
                    </p>
                    {c.tier && (
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                          TIER_CONFIG[c.tier].bgColor,
                          TIER_CONFIG[c.tier].textColor
                        )}
                      >
                        {c.tier}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.company || "Independent"}
                    <span className="mx-1">·</span>
                    {touchLabel(c.last_touch_date)}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end">
                  <span
                    className="text-2xl font-mono font-semibold leading-none"
                    style={{ color: tempColor(c.temperature) }}
                  >
                    {c.temperature}
                  </span>
                  <span className="text-[9px] font-mono uppercase tracking-wide text-muted-foreground mt-0.5">
                    TEMP
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
