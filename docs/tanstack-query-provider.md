# TanStack Query Provider

## What it does

Wraps the `(app)` route group with a single `QueryClientProvider` so every
dashboard widget and client component can use `useQuery` and `useMutation`
with a shared cache. It is the client-side counterpart to the Supabase
Realtime subscription layer: widgets read from the query cache, and realtime
channels invalidate cache keys to pull fresh data.

## Where it lives

`/Users/alex/crm/src/components/query-provider.tsx` (40 lines total).

Consumed by `/Users/alex/crm/src/app/(app)/layout.tsx` at line 8:

```tsx
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="ml-56 p-6">{children}</main>
        <CommandPalette />
        <Toaster position="bottom-right" />
      </div>
    </QueryProvider>
  );
}
```

## Implementation details

```tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

Key details:

- **`"use client"`** at line 1. Required because `QueryClient` holds
  mutable state and `QueryClientProvider` uses React context that cannot
  cross the server/client boundary.
- **`useState(() => new QueryClient(...))`** at line 23. Passing a factory
  to `useState` creates the client exactly once per component mount. The
  server renders a fresh client per request, the client reuses a singleton
  across rerenders.
- **`staleTime: 30 * 1000`** (30s default). Individual queries override
  this per data type.
- **`refetchOnWindowFocus: false`**. Off because Supabase Realtime handles
  freshness; window focus would cause double-fetching.
- **`retry: 1`**. Single retry on failure.

## Stale time defaults (per dashboard.md Section 6)

| Data type | staleTime | Notes |
|---|---|---|
| KPI cards | 60 seconds | Recalculated on the minute |
| Task lists | 30 seconds | Plus Realtime invalidation |
| Agent profiles | 5 minutes | Rarely change |
| User preferences | Infinity | Manual invalidation only |

These values are not enforced by the provider. Each `useQuery` hook sets
its own `staleTime` to the target value. Example from
`/Users/alex/crm/src/components/dashboard/task-list.tsx`:

- Bucket 1 (overdue follow-ups): `staleTime: 30_000` (line 161)
- Bucket 2 (closings): `staleTime: 60_000` (line 188)
- Bucket 3 (going cold): `staleTime: 60_000` (line 217)
- Bucket 5 (proactive): `staleTime: 60_000` (line 247)
- Bucket 6 (stalled pipeline): `staleTime: 60_000` (line 274)

## Why a single QueryClient for the whole app

Per `dashboard.md` locked decision: "TanStack Query v5 as the primary cache
layer." A single client means every widget participates in the same cache,
so invalidating `["task-list", "overdue_followups", userId]` from one place
updates every component reading that key.

## Integration with Supabase Realtime

The pattern is defined in `dashboard.md`: "Supabase Realtime invalidates
TanStack Query caches. Never update component state directly from a
Realtime event."

Example from `task-list.tsx` lines 295 to 356:

```tsx
const channels = [
  supabase
    .channel("task-list:follow_ups")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "follow_ups" },
      () => {
        queryClient.invalidateQueries({
          queryKey: ["task-list", "overdue_followups", userId],
        });
      }
    )
    .subscribe(),
  // ... more channels
];

return () => {
  channels.forEach((c) => supabase.removeChannel(c));
};
```

Pattern:

1. Subscribe to `postgres_changes` on the table
2. On any change event, call `queryClient.invalidateQueries` with the
   matching query key
3. TanStack Query re-runs the query function and updates every subscriber
4. Unsubscribe on unmount via the effect cleanup

## Dependencies

- `@tanstack/react-query` v5.96.2 (per `package.json`)
- `react` 18 for hooks

## Known constraints

Per `dashboard.md`:

- Do not create multiple QueryClient instances. The provider is the single
  source of truth.
- Do not call `queryClient.setQueryData` as a substitute for real data
  fetching. Use invalidation and let the cache refetch.
- Server Components prefetch via `prefetchQuery` wrapped in
  `HydrationBoundary` when needed, but Phase 1 widgets are all client-side
  queries.

## Adding a new query

For a new dashboard widget:

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function NewWidget({ userId }: { userId: string }) {
  const supabase = createClient();
  const query = useQuery({
    queryKey: ["widget-name", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("some_view")
        .select("*")
        .eq("user_id", userId);
      if (error) throw error;
      return data ?? [];
    },
  });
  // render query.data, query.isLoading, query.error
}
```

Wire a Realtime channel in a sibling `useEffect` to invalidate
`["widget-name", userId]` on relevant table changes.
