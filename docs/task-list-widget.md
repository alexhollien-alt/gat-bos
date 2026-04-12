# TaskListWidget (Linear Focus Today View)

## What it does

The Tier 1 dashboard widget that replaces the old `ActionQueueWidget`.
Renders the six Linear Focus buckets from Section 5 of
`.claude/rules/dashboard.md` in fixed priority order, each backed by its
own TanStack Query hook, with Supabase Realtime invalidation and
optimistic complete/snooze mutations.

## Where it lives

`/Users/alex/crm/src/components/dashboard/task-list.tsx` (978 lines). This
is the single largest client component in the dashboard.

Rendered by `/Users/alex/crm/src/app/(app)/dashboard/page.tsx` at line 117
inside the left column (2/3 width) of the dashboard grid.

## Bucket order (per Section 5 of dashboard.md)

| # | Bucket | Color | Source query | Notes |
|---|---|---|---|---|
| 1 | Overdue follow-ups | `#e63550` crimson | `follow_ups` table | `status = 'pending' AND due_date <= today` |
| 2 | Closings today/tomorrow | `#f97316` orange | `deals` table | `stage IN ('in_escrow', 'clear_to_close') AND scheduled_close_date BETWEEN today AND tomorrow` |
| 3 | Agents going cold | `#eab308` yellow | `agent_health` view | `trend_direction = 'down' OR days_since_contact >= 21`, filtered to A/B/C (no P) |
| 4 | Scheduled meetings/calls | blue | skipped in v1 | No calendar wired yet |
| 5 | Proactive touchpoints | `#22c55e` green | `agent_health` view | `health_score >= 60 AND days_since_contact BETWEEN 7 AND 20`, A/B only |
| 6 | Pipeline items needing attention | `#71717a` gray | `opportunities` table | `opened_at <= now() - 30 days` |

Constants at lines 54 to 63.

## Entry points

- `TaskListWidget()` at line 139
- `followUpsQuery` at line 158 (bucket 1)
- `closingsQuery` at line 185 (bucket 2)
- `goingColdQuery` at line 214 (bucket 3)
- `proactiveQuery` at line 244 (bucket 5)
- `pipelineQuery` at line 271 (bucket 6)
- Realtime subscription effect at line 295

## Data fetching per bucket

Each bucket uses `useQuery` with:

- A query key of shape `["task-list", <bucket-name>, userId]`
- `enabled: !!userId` so the query waits until user resolution completes
- Bucket-specific `staleTime` (30s for follow-ups, 60s for everything
  else)
- Direct Supabase client calls via `createClient()` memoized at line 140

Example (bucket 1, lines 158 to 180):

```tsx
const followUpsQuery = useQuery({
  queryKey: ["task-list", "overdue_followups", userId],
  enabled: !!userId,
  staleTime: 30_000,
  queryFn: async (): Promise<FollowUpRow[]> => {
    const today = todayISO();
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("follow_ups")
      .select(
        "id, reason, due_date, priority, contact_id, contacts(id, first_name, last_name, tier, phone, email)"
      )
      .eq("user_id", userId!)
      .eq("status", "pending")
      .is("deleted_at", null)
      .or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`)
      .lte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(20);
    if (error) throw error;
    return (data ?? []) as unknown as FollowUpRow[];
  },
});
```

Note the soft-delete filter `is("deleted_at", null)` and the snooze OR
clause `snoozed_until.is.null,snoozed_until.lte.${nowIso}`, which surfaces
follow-ups whose snooze has expired.

## Bucket 3 tier filtering

Lines 229 to 232:

```tsx
return ((data ?? []) as unknown as AgentHealthRow[]).filter(
  (r) => r.contacts?.tier && r.contacts.tier !== "P"
);
```

Client-side filter to drop P (prospect) tier contacts from the
"going cold" bucket. P contacts are by definition cold until they warm up,
so they would flood the bucket. The filter runs after the Supabase query
returns. Bucket 5 does the equivalent filter at lines 261 to 264, keeping
only A and B tiers.

## Realtime invalidation (lines 295 to 356)

Four channels:

| Channel | Table | Invalidated keys |
|---|---|---|
| `task-list:follow_ups` | `follow_ups` | `["task-list", "overdue_followups", userId]` |
| `task-list:deals` | `deals` | `["task-list", "closings", userId]` |
| `task-list:interactions` | `interactions` | both `"going_cold"` and `"proactive"` |
| `task-list:opportunities` | `opportunities` | `["task-list", "stalled_pipeline", userId]` |

Cleanup at lines 353 to 355 unsubscribes all channels.

## Type definitions

Lines 68 to 112 define row shapes that mirror the Supabase select strings:

- `ContactRef` -- minimal contact join (`id`, `first_name`, `last_name`,
  `tier`, `phone`, `email`)
- `FollowUpRow` -- `id`, `reason`, `due_date`, `priority`, `contact_id`,
  `contacts`
- `ClosingRow` -- `id`, `property_address`, `scheduled_close_date`,
  `stage`, `contact_id`, `contacts`
- `AgentHealthRow` -- `contact_id`, `health_score`, `days_since_contact`,
  `trend_direction`, `contacts`
- `OpportunityRow` -- `id`, `property_address`, `stage`, `opened_at`,
  `expected_close_date`, `contact_id`, `contacts`

## Helpers

- `contactName(c)` at line 118 -- joins first + last, defaults to
  `"Unknown"` or `"Unnamed"`
- `todayISO()` at line 123 -- current date as `YYYY-MM-DD`
- `formatRelative(dateStr)` at line 127 -- `formatDistanceToNowStrict`
  wrapper with error fallback

## Constraints honored

Per `.claude/rules/dashboard.md`:

- NO client-side `health_score` bumps. The materialized view owns the
  computed score. Manual bumps happen only in the Resend webhook
  (`/api/webhooks/resend`), which writes to `contacts.health_score` and
  gets coalesced into the `agent_health` view.
- Workspace tier visuals: dark cards, hover transitions only, no
  frosted glass, no gradient mesh.
- Accessibility floor: `role`, `aria-label`, `aria-live`, always-visible
  buttons, 44x44 touch targets on mobile.
- `ITEMS_PER_BUCKET = 3` (line 54) keeps the widget scannable. Users
  click into a bucket to see the full list.
- Tasks are never sorted by creation date on the Today View (explicit
  rule from dashboard.md).

## Dependencies

- `@tanstack/react-query` v5 for `useQuery`, `useMutation`,
  `useQueryClient`
- `@supabase/supabase-js` client via `@/lib/supabase/client`
- `date-fns` for `addDays`, `format`, `formatDistanceToNowStrict`
- `lucide-react` icons: `AlertCircle`, `Home`, `Snowflake`, `Sparkles`,
  `TrendingDown`, `Phone`, `Mail`, `Clock`, `CheckCircle2`,
  `ExternalLink`, `Target`
- shadcn `Card`, `CardContent`, `CardHeader`, `CardTitle`
- `next/link` for navigation to detail pages

## Tables read

- `follow_ups` -- bucket 1
- `deals` -- bucket 2
- `agent_health` (view) -- buckets 3 and 5
- `opportunities` -- bucket 6

## Known constraints

- Bucket 4 (scheduled meetings) is not implemented because there is no
  calendar integration yet. When Google Calendar lands, add a query that
  reads from the calendar table or directly from the GCal API.
- If `userId` fails to resolve (no session), all queries stay disabled
  and the widget renders empty buckets.
- The widget only reads. Mutations (complete, snooze) live in the lower
  600 lines of the file and use optimistic updates through TanStack
  Query's `useMutation`.

## Example: adding a new bucket

If you need a bucket 7 for "Warm inbound leads":

1. Define a new `useQuery` with key `["task-list", "warm_inbound", userId]`
2. Add a new `supabase.channel("task-list:contacts")` subscription in the
   realtime effect that invalidates that key
3. Add the bucket to the render section in the lower half of the file
4. Pick an unused color from the palette (e.g. `#3b82f6` signal blue)
5. Update the bucket order in this doc and in `dashboard.md` Section 5
