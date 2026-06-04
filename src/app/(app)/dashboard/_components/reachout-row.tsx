"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { TemperatureRow } from "@/lib/scoring/temperature";
import { DaysBadge } from "./days-badge";

export function ReachoutRow({
  row,
  onLog,
}: {
  row: TemperatureRow;
  onLog: (row: TemperatureRow) => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60">
      <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">
        {row.tier}
      </span>
      <Link
        href={`/contacts/${row.contact_id}`}
        className="min-w-0 flex-1"
        prefetch={false}
      >
        <div className="truncate text-sm font-medium text-foreground">
          {row.full_name || "Unnamed"}
        </div>
        {row.brokerage && (
          <div className="truncate text-xs text-muted-foreground">
            {row.brokerage}
          </div>
        )}
      </Link>
      <DaysBadge days={row.days_since_last_touchpoint} drift={row.drift} />
      <Button
        size="sm"
        variant="default"
        className="h-7 shrink-0 px-2.5"
        onClick={() => onLog(row)}
      >
        Log touch
      </Button>
    </li>
  );
}
