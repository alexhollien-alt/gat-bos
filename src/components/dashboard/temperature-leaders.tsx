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
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
          <Thermometer className="h-4 w-4" />
          Hottest Contacts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">No temperature data yet</p>
        ) : (
          <div className="space-y-3">
            {contacts.map((c) => (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-700 truncate">
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
                  <p className="text-xs text-slate-400 truncate">
                    {c.company || "Independent"}
                    <span className="mx-1">·</span>
                    {touchLabel(c.last_touch_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-16 bg-slate-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${c.temperature}%`,
                        backgroundColor: tempColor(c.temperature),
                      }}
                    />
                  </div>
                  <span
                    className="text-xs font-semibold w-7 text-right"
                    style={{ color: tempColor(c.temperature) }}
                  >
                    {c.temperature}
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
