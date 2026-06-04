"use client";

// Full roster grouped by tier. A/B/C come from the recency scorer (with a
// days-since badge); tier P (parked prospects) is shown as a muted group so no
// contact is silently hidden. Rows link to the contact detail page.

import type { ReactNode } from "react";
import type { TemperatureRow } from "@/lib/scoring/temperature";
import { useScored, useProspects } from "../queries";
import { AgentRow } from "./agent-row";

function TierGroup({
  label,
  count,
  muted,
  children,
}: {
  label: string;
  count: number;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2
          className={
            muted
              ? "text-sm font-medium text-muted-foreground"
              : "text-sm font-semibold text-foreground"
          }
        >
          {label}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      </header>
      <div className="p-1">
        {count === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            None
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export function AgentsTab({ active }: { active: boolean }) {
  const { data: scored } = useScored();
  const { data: prospects } = useProspects(active);

  const byTier: Record<"A" | "B" | "C", TemperatureRow[]> = { A: [], B: [], C: [] };
  for (const r of scored ?? []) {
    if (r.tier === "A" || r.tier === "B" || r.tier === "C") byTier[r.tier].push(r);
  }
  (["A", "B", "C"] as const).forEach((t) =>
    byTier[t].sort((a, b) => b.effective_drift - a.effective_drift),
  );

  const prospectRows = prospects ?? [];

  return (
    <div className="space-y-4 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto lg:pr-1">
      {(["A", "B", "C"] as const).map((t) => (
        <TierGroup key={t} label={`Tier ${t}`} count={byTier[t].length}>
          {byTier[t].map((r) => (
            <AgentRow
              key={r.contact_id}
              id={r.contact_id}
              name={r.full_name || "Unnamed"}
              brokerage={r.brokerage}
              days={r.days_since_last_touchpoint}
              drift={r.drift}
            />
          ))}
        </TierGroup>
      ))}
      {prospectRows.length > 0 && (
        <TierGroup label="Prospects" count={prospectRows.length} muted>
          {prospectRows.map((p) => (
            <AgentRow
              key={p.id}
              id={p.id}
              name={p.full_name || "Unnamed"}
              brokerage={p.brokerage}
            />
          ))}
        </TierGroup>
      )}
    </div>
  );
}
