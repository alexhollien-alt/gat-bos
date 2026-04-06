import { Contact } from "@/lib/types";
import { Flame, Thermometer, Snowflake, Wind } from "lucide-react";

interface TempBucket {
  label: string;
  range: string;
  count: number;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

export function TemperatureSummaryBanner({
  contacts,
}: {
  contacts: Contact[];
}) {
  const withTemp = contacts.filter((c) => c.temperature > 0);
  const avg =
    withTemp.length > 0
      ? Math.round(
          withTemp.reduce((sum, c) => sum + c.temperature, 0) / withTemp.length
        )
      : 0;

  const buckets: TempBucket[] = [
    {
      label: "Hot",
      range: "80+",
      count: contacts.filter((c) => c.temperature >= 80).length,
      color: "text-red-600",
      bgColor: "bg-red-50 border-red-100",
      icon: <Flame className="h-4 w-4 text-red-500" />,
    },
    {
      label: "Warm",
      range: "60-79",
      count: contacts.filter(
        (c) => c.temperature >= 60 && c.temperature < 80
      ).length,
      color: "text-orange-600",
      bgColor: "bg-orange-50 border-orange-100",
      icon: <Thermometer className="h-4 w-4 text-orange-500" />,
    },
    {
      label: "Cool",
      range: "20-59",
      count: contacts.filter(
        (c) => c.temperature >= 20 && c.temperature < 60
      ).length,
      color: "text-blue-600",
      bgColor: "bg-blue-50 border-blue-100",
      icon: <Wind className="h-4 w-4 text-blue-500" />,
    },
    {
      label: "Cold",
      range: "0-19",
      count: contacts.filter((c) => c.temperature < 20).length,
      color: "text-slate-600",
      bgColor: "bg-slate-50 border-slate-200",
      icon: <Snowflake className="h-4 w-4 text-slate-400" />,
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
            <p className={`text-lg font-semibold leading-none ${b.color}`}>
              {b.count}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {b.label} ({b.range})
            </p>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-white border-slate-200">
        <Thermometer className="h-4 w-4 text-slate-400" />
        <div>
          <p className="text-lg font-semibold leading-none text-slate-700">
            {avg}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Avg temp</p>
        </div>
      </div>
    </div>
  );
}
