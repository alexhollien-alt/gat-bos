# Supabase Realtime Subscription Pattern

## What it does

Keeps dashboard widgets in sync with the database in near real time. Every
widget that reads live-changing data subscribes to `postgres_changes` on the
relevant tables and calls `queryClient.invalidateQueries` when an event
arrives. TanStack Query refetches the stale queries and the UI updates.

## Where it lives

Reference implementation:
`/Users/alex/crm/src/components/dashboard/task-list.tsx` lines 293 to 356.

Other places that subscribe:

- `/Users/alex/crm/src/app/(app)/contacts/page.tsx` (contacts listing)
- `/Users/alex/crm/src/components/contacts/bio-panel.tsx` (contact detail)
- `/Users/alex/crm/src/lib/types.ts` (type imports only)

Publication is configured at the database level in
`/Users/alex/crm/supabase/dashboard-piece2-add-infrastructure.sql` lines
349 to 383, which idempotently adds `interactions`, `opportunities`,
`deals`, and `tasks` to `supabase_realtime`. Piece 4 adds `follow_ups`.

## Canonical pattern

```tsx
"use client";
import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function MyWidget() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  // Resolve user once
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Subscribe
  useEffect(() => {
    if (!userId) return;

    const channels = [
      supabase
        .channel("my-widget:follow_ups")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "follow_ups" },
          () => {
            queryClient.invalidateQueries({
              queryKey: ["my-widget", "follow_ups", userId],
            });
          }
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [userId, queryClient, supabase]);
}
```

## Channel naming convention

`"<widget-scope>:<table>"`, as in the task-list example at line 300:

- `"task-list:follow_ups"`
- `"task-list:deals"`
- `"task-list:interactions"`
- `"task-list:opportunities"`

Each channel is a distinct subscription. Supabase keeps channel names
scoped per client, so different widgets can subscribe to the same table
with different channel names without stepping on each other.

## Query key invalidation pattern

From `task-list.tsx` line 326 to 336:

```tsx
supabase
  .channel("task-list:interactions")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "interactions" },
    () => {
      // Interactions feed agent_health via the materialized view trigger
      queryClient.invalidateQueries({
        queryKey: ["task-list", "going_cold", userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["task-list", "proactive", userId],
      });
    }
  )
  .subscribe();
```

A single table change can invalidate multiple query keys. When a new
interaction inserts, both the "going cold" and "proactive touchpoints"
buckets need to refetch because they both read from the `agent_health`
view which depends on `interactions` through the materialized view's
refresh trigger.

## Why invalidation, not manual cache update

Per `.claude/rules/dashboard.md`: "Supabase Realtime invalidates TanStack
Query caches. Never update component state directly from a Realtime
event."

The reason: the Realtime payload is the raw row change. Widgets render
joined data (e.g. `follow_ups` joined to `contacts` joined to
`agent_health`). Reconstructing the joined shape client-side from a
single-row payload duplicates server logic and drifts out of sync. Letting
the query refetch guarantees the widget sees the exact shape the server
returns.

## Cleanup

Always return a cleanup function that calls `supabase.removeChannel(c)`
for each channel. Forgetting this leaks subscriptions and causes duplicate
event handling after hot reload.

From `task-list.tsx` lines 353 to 355:

```tsx
return () => {
  channels.forEach((c) => supabase.removeChannel(c));
};
```

## Tables in the Realtime publication

Per `dashboard-piece2-add-infrastructure.sql` lines 349 to 383 and
`dashboard-piece4-follow-ups-table.sql` lines 149 to 160:

- `interactions`
- `opportunities`
- `deals`
- `tasks`
- `follow_ups`

`contacts` and views like `agent_health` are not in the publication. If
you need to refetch on `contacts` change, either add `contacts` to the
publication (in a new migration) or subscribe to the table that drives the
contact change (for example `interactions` for health score updates).

## Dependencies

- `@supabase/supabase-js` channel API
- `@tanstack/react-query` `useQueryClient` hook
- A `QueryClientProvider` ancestor (see `components/query-provider.tsx`)
- Supabase Postgres logical replication slot and `supabase_realtime`
  publication (Supabase default)

## Known constraints

Per `.claude/rules/dashboard.md`:

- Never update component state directly from a Realtime event.
- The pattern is hybrid: Realtime is the invalidation signal, TanStack
  Query is the cache. Do not try to replace TanStack Query with raw
  Realtime.
- Subscriptions live in `useEffect` hooks only. Do not put them in event
  handlers or render.

## Performance notes

- The materialized view `agent_relationship_health` refreshes on every
  `interactions` or `deals` change via a statement-level trigger. At
  Alex's scale (~25 agents), that is acceptable.
- If you add a new subscription for a high-churn table, consider
  debouncing invalidation with `setTimeout` to coalesce bursts. No widget
  currently needs this.
- `supabase.channel()` calls are cheap until `.subscribe()`. Bundle all
  subscriptions for one widget into a single `useEffect`.
