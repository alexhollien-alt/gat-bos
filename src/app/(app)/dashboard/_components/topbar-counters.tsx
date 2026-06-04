"use client";

// Live counters above the tabs. Both update optimistically as the user logs
// touches and checks off tasks (see useLogTouch / useToggleTask).

import { useCounters } from "../queries";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="text-2xl font-semibold tabular-nums text-foreground"
        aria-live="polite"
      >
        {value}
      </span>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function TopbarCounters() {
  const { data } = useCounters();
  const c = data ?? { touches: 0, tasksDone: 0 };
  return (
    <div className="flex items-center gap-6">
      <Stat label="Touches today" value={c.touches} />
      <Stat label="Tasks done" value={c.tasksDone} />
    </div>
  );
}
