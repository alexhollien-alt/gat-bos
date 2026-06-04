"use client";

// LEFT pane of the Today tab: who needs a touch, sorted by tier-aware drift
// (most overdue first). effective_drift > -1 keeps overdue + due-today rows.
// Logging a touch optimistically drops the row (see useLogTouch).

import { useScored, useLogTouch } from "../queries";
import { ReachoutRow } from "./reachout-row";

export function ReachoutList() {
  const { data, isLoading } = useScored();
  const log = useLogTouch();

  const rows = (data ?? [])
    .filter((r) => r.effective_drift > -1)
    .sort((a, b) => b.effective_drift - a.effective_drift)
    .slice(0, 30);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">Reach out</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {rows.length}
        </span>
      </header>
      <ul className="min-h-0 flex-1 overflow-y-auto p-1">
        {isLoading ? (
          <li className="px-3 py-8 text-center text-sm text-muted-foreground">
            Loading...
          </li>
        ) : rows.length === 0 ? (
          <li className="px-3 py-8 text-center text-sm text-muted-foreground">
            All caught up
          </li>
        ) : (
          rows.map((r) => (
            <ReachoutRow
              key={r.contact_id}
              row={r}
              onLog={(row) =>
                log.mutate({ contact_id: row.contact_id, name: row.full_name })
              }
            />
          ))
        )}
      </ul>
    </section>
  );
}
