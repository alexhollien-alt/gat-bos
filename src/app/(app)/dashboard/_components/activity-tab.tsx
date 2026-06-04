"use client";

// Weekly activity (rolling 7 days) vs goals. Cold calls / open houses / new
// agent meetings map to activity_events verbs; BNI follow-ups use a stand-in
// proxy. Goals are placeholders until Alex sets real targets.

import { useWeekly } from "../queries";
import { ProgressBar } from "./progress-bar";

// TODO(alex): replace with real weekly targets.
const GOALS = { calls: 50, openHouses: 2, meetings: 5, bni: 10 };

export function ActivityTab({ active }: { active: boolean }) {
  const { data } = useWeekly(active);
  const w = data ?? { calls: 0, openHouses: 0, meetings: 0, bni: 0 };

  const rows = [
    { label: "Cold calls", value: w.calls, goal: GOALS.calls },
    { label: "Open houses", value: w.openHouses, goal: GOALS.openHouses },
    { label: "New agent meetings", value: w.meetings, goal: GOALS.meetings },
    { label: "BNI follow-ups", value: w.bni, goal: GOALS.bni },
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-xs text-muted-foreground">
        This week (last 7 days) vs goals
      </p>
      {rows.map((r) => (
        <div key={r.label} className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-foreground">{r.label}</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">{r.value}</span> /{" "}
              {r.goal}
            </span>
          </div>
          <ProgressBar value={r.value} goal={r.goal} />
        </div>
      ))}
      <p className="text-[11px] leading-relaxed text-muted-foreground/70">
        Goals are placeholders. BNI follow-ups use interaction.note as a stand-in
        until a dedicated source is wired.
      </p>
    </div>
  );
}
