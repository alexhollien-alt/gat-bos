# Dashboard Page Layout

## What it does

The main `/dashboard` route. Pulls contacts, opportunities, interactions,
and health data from Supabase, computes relationship stats client-side,
and composes eight widgets into a two-column grid. This is a client
component; every widget it renders is also client-side.

## Where it lives

`/Users/alex/crm/src/app/(app)/dashboard/page.tsx` (132 lines).

Route: `/dashboard` (inside the `(app)` route group, protected by auth
middleware).

## Layout structure

```
+-----------------------------------------------------------+
| Today header (1/3)        | PrintTicketsPanel (2/3)        |
+-----------------------------------------------------------+
| HealthSummaryBanner (full width)                           |
+-----------------------------------------------------------+
| Left column (2/3):         | Right column (1/3):           |
|  - TaskListWidget          |  - HealthLeadersWidget        |
|  - CampaignTimelineWidget  |  - QuickActionsWidget         |
|  - PipelineSnapshotWidget  |  - RelationshipStatsWidget    |
|                            |  - RecentInteractionsWidget   |
+-----------------------------------------------------------+
```

CSS Grid: `grid-cols-1 lg:grid-cols-3 gap-4`. The left column spans 2 of
3 columns via `lg:col-span-2`.

## Key entry points

- `DashboardPage()` at line 22
- `fetchAll()` at line 39
- Top row header at lines 96 to 109
- `HealthSummaryBanner` at line 111
- Left column at lines 115 to 121
- Right column at lines 122 to 128

## Data fetching

All data loads from `fetchAll()` on mount (line 90 to 92). Four Supabase
queries run in sequence:

1. **Hottest contacts** (lines 41 to 48): top 8 contacts where
   `health_score > 0`, ordered by score descending
2. **All contacts** (lines 51 to 72): every non-deleted contact, also
   used to build the relationship stats counter
3. **Opportunities** (lines 75 to 79): every opportunity with contact
   name joined, ordered by created_at descending
4. **Recent interactions** (lines 82 to 87): top 8 by `occurred_at`
   descending

No TanStack Query on this page; it uses raw `useState` + `useEffect`.
The child `TaskListWidget` uses TanStack Query internally. This is
historical; a future refactor should move these direct reads into
`useQuery` hooks so they participate in the shared cache.

## Relationship stats computation

Lines 60 to 72 count contacts per `stage` (the DB column that holds
relationship strength):

```ts
const counts: Record<RelationshipStrength, number> = {
  new: 0,
  warm: 0,
  active_partner: 0,
  advocate: 0,
  dormant: 0,
};
contactsData.forEach((c) => {
  const r = c.relationship as RelationshipStrength;
  if (r in counts) counts[r]++;
});
setStats(counts);
```

Known bug: the loop reads `c.relationship` but the live DB column is
`stage`. Per `project_contacts_column_truth` memory, this should be
`c.stage`. The counter will return all zeros against the current schema.
Fix when touching this page: change `c.relationship` to `c.stage`.

## Widgets rendered

All nine dashboard widgets under
`/Users/alex/crm/src/components/dashboard/` are imported at the top of
the file (lines 11 to 19):

- `HealthLeadersWidget` -- top 8 hottest contacts
- `HealthSummaryBanner` -- full-width rollup of relationship counts
- `PipelineSnapshotWidget` -- opportunity count by stage
- `RecentInteractionsWidget` -- last 8 interactions
- `RelationshipStatsWidget` -- stage counts
- `QuickActionsWidget` -- fast action buttons (new contact, log call)
- `TaskListWidget` -- the 6-bucket Linear Focus Today View
- `PrintTicketsPanel` -- Cypher ticket status panel
- `CampaignTimelineWidget` -- 30-day campaign activity chart (Recharts)

Not rendered but present in the dashboard folder:

- `follow-ups-due.tsx` -- superseded by bucket 1 of `TaskListWidget`
- `health-summary.tsx` (separate from `HealthSummaryBanner`)
- `recent-contacts.tsx`
- `stale-contacts.tsx`
- `tasks-due.tsx`

These older widgets remain in the repo but the dashboard only renders
the set above.

## Typography and spacing

Line 99: header uses `font-display` (Syne via CSS variable per
`digital-aesthetic.md`). Line 102: date line uses `font-mono` (Space
Mono), matching the "every number uses Space Mono" rule.

Main container: `max-w-7xl` at line 95. Grid gap: `gap-4`. Section
spacing: `mb-6` between the top row and the health summary.

## Dependencies

- `@/lib/supabase/client` for the browser Supabase client
- `@/lib/types` for `Contact`, `Interaction`, `Opportunity`,
  `RelationshipStrength` types
- `date-fns` for `format`
- All nine widgets from `@/components/dashboard/*`

## Known constraints

Per `.claude/rules/dashboard.md`:

- Layout is static bento grid, not drag-and-drop
- Cap at 8 to 10 visible cards (this page has 9)
- Workspace tier visuals (dark cards, no glass, no mesh)
- Responsive collapse by priority; the lg: prefix kicks in at 1024px,
  below that everything stacks single column
- Health scores come from the materialized view via the `agent_health`
  coalesce view; never computed client-side

## Example: replacing the stage count bug

Change line 68 from:

```ts
const r = c.relationship as RelationshipStrength;
```

to:

```ts
const r = c.stage as RelationshipStrength;
```

The type import already includes `stage` as the correct field name;
`relationship` is a legacy alias that does not exist on the live
`contacts` table.
