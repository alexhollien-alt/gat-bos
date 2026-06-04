"use client";

import Link from "next/link";
import { DaysBadge } from "./days-badge";

export function AgentRow({
  id,
  name,
  brokerage,
  days,
  drift,
}: {
  id: string;
  name: string;
  brokerage: string | null;
  days?: number | null;
  drift?: number;
}) {
  return (
    <Link
      href={`/contacts/${id}`}
      prefetch={false}
      className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {name}
        </div>
        {brokerage && (
          <div className="truncate text-xs text-muted-foreground">
            {brokerage}
          </div>
        )}
      </div>
      {days !== undefined && <DaysBadge days={days} drift={drift} />}
    </Link>
  );
}
