// src/app/(app)/inbox/inbox-client.tsx
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InboxItem } from "@/lib/inbox/types";
import { InboxRow } from "@/components/inbox/inbox-row";
import { Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccentRule, PageHeader, SectionShell } from "@/components/screen";

async function fetchPendingItems(): Promise<InboxItem[]> {
  const res = await fetch("/api/inbox/items?status=pending&limit=50");
  if (!res.ok) throw new Error("Failed to fetch inbox items");
  const json = await res.json();
  return json.items ?? [];
}

async function patchItem(id: string, status: "replied" | "dismissed") {
  const res = await fetch(`/api/inbox/items?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update item");
}

export function InboxClient() {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, dataUpdatedAt } = useQuery<InboxItem[]>({
    queryKey: ["inbox", "items", "pending"],
    queryFn: fetchPendingItems,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "replied" | "dismissed" }) =>
      patchItem(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox", "items", "pending"] });
    },
  });

  const count = items.length;
  const updatedLabel = dataUpdatedAt
    ? `updated ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : "";

  const subhead =
    (count === 0
      ? "No threads need a reply"
      : `${count} thread${count !== 1 ? "s" : ""} need${count === 1 ? "s" : ""} a reply`) +
    (updatedLabel ? ` · ${updatedLabel}` : "");

  return (
    <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0 max-w-3xl mx-0">
      <PageHeader
        eyebrow="Needs reply"
        title="Inbox"
        subhead={subhead}
        right={
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["inbox", "items"] })}
            className="gap-2"
            aria-label="Refresh inbox"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />
      <AccentRule variant="hairline" className="mt-6 mb-6" />

      {isLoading && (
        <div className="space-y-3" aria-label="Loading inbox">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg border border-border bg-card animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && count === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Queue is clear</p>
          <p className="text-xs text-muted-foreground mt-1">
            Next scan runs automatically every 30 minutes
          </p>
        </div>
      )}

      {!isLoading && count > 0 && (
        <div className="space-y-2" role="list" aria-label="Threads needing a reply">
          {items.map((item) => (
            <InboxRow
              key={item.id}
              item={item}
              onDismiss={(id) => mutation.mutate({ id, status: "dismissed" })}
              onMarkReplied={(id) => mutation.mutate({ id, status: "replied" })}
              isMutating={mutation.isPending && mutation.variables?.id === item.id}
            />
          ))}
        </div>
      )}
    </SectionShell>
  );
}
