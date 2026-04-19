import { Contact } from "@/lib/types";
import { Flame, Thermometer, Snowflake, Wind } from "lucide-react";
import { MonoNumeral } from "@/components/screen";

interface TempBucket {
  label: string;
  range: string;
  count: number;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

export function HealthSummaryBanner({
  contacts,
}: {
  contacts: Contact[];
}) {
  const withTemp = contacts.filter((c) => c.health_score > 0);
  const avg =
    withTemp.length > 0
      ? Math.round(
          withTemp.reduce((sum, c) => sum + c.health_score, 0) / withTemp.length
        )
      : 0;

  const buckets: TempBucket[] = [
    {
      label: "Hot",
      range: "80+",
      count: contacts.filter((c) => c.health_score >= 80).length,
      color: "text-red-400",
      bgColor: "bg-red-500/10 border-red-500/20",
      icon: <Flame className="h-4 w-4 text-red-400" />,
    },
    {
      label: "Warm",
      range: "60-79",
      count: contacts.filter(
        (c) => c.health_score >= 60 && c.health_score < 80
      ).length,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10 border-orange-500/20",
      icon: <Thermometer className="h-4 w-4 text-orange-400" />,
    },
    {
      label: "Cool",
      range: "20-59",
      count: contacts.filter(
        (c) => c.health_score >= 20 && c.health_score < 60
      ).length,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10 border-blue-500/20",
      icon: <Wind className="h-4 w-4 text-blue-400" />,
    },
    {
      label: "Cold",
      range: "0-19",
      count: contacts.filter((c) => c.health_score < 20).length,
      color: "text-zinc-400",
      bgColor: "bg-zinc-500/10 border-zinc-500/20",
      icon: <Snowflake className="h-4 w-4 text-zinc-500" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
      {buckets.map((b) => (
        <div
          key={b.label}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${b.bgColor}`}
        >
          {b.icon}
          <div>
            <MonoNumeral size="md" className={`block font-semibold ${b.color}`}>
              {b.count}
            </MonoNumeral>
            <p className="text-xs text-muted-foreground mt-0.5">
              {b.label} ({b.range})
            </p>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card border-border">
        <Thermometer className="h-4 w-4 text-muted-foreground" />
        <div>
          <MonoNumeral size="md" className="block font-semibold text-foreground">
            {avg}
          </MonoNumeral>
          <p className="text-xs text-muted-foreground mt-0.5">Avg score</p>
        </div>
      </div>
    </div>
  );
}
