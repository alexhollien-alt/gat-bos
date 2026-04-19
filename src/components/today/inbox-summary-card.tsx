// src/components/today/inbox-summary-card.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import type { InboxItem } from "@/lib/inbox/types";
import Link from "next/link";

async function fetchPendingCount(): Promise<InboxItem[]> {
  const res = await fetch("/api/inbox/items?status=pending&limit=50");
  if (!res.ok) return [];
  const json = await res.json();
  return json.items ?? [];
}

export function InboxSummaryCard() {
  const { data: items = [] } = useQuery<InboxItem[]>({
    queryKey: ["inbox", "items", "pending"],
    queryFn: fetchPendingCount,
    staleTime: 60_000,
  });

  const count = items.length;
  const label = count === 0
    ? "Inbox clear"
    : `${count}${count === 50 ? "+" : ""} thread${count !== 1 ? "s" : ""} need${count === 1 ? "s" : ""} a reply`;

  return (
    <Link
      href="/inbox"
      className="block rounded-lg border border-border bg-card p-4 hover:border-foreground/20 transition-colors"
      aria-label={`Inbox: ${label}`}
    >
      <p className={count > 0 ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground"}>
        {label}
      </p>
    </Link>
  );
}
