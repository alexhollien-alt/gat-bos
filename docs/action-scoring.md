# Action Scoring Library

## What it does

Pure scoring functions that rank actionable items (follow-ups, tasks,
stale contacts) for the `/actions` page. Each item gets a 0-100 score
based on type, contact tier, days overdue, and the contact's health
score. Higher score = more urgent.

## Where it lives

`/Users/alex/crm/src/lib/action-scoring.ts` (208 lines).

Consumed by:

- `/Users/alex/crm/src/app/(app)/actions/page.tsx` (lines 38 to 80)
  via `buildFollowUpActions`, `buildTaskActions`, `buildStaleActions`

## Key entry points

- `scoreAction(item)` at line 35 -- the core scorer
- `buildFollowUpActions(rows)` -- builds action items from `follow_ups`
  query results
- `buildTaskActions(rows)` -- builds from `tasks` query results
- `buildStaleActions(contacts, lastInteractions)` -- builds from
  stale contacts

## Scoring weights (lines 8 to 29)

### By type

```ts
const TYPE_WEIGHT: Record<ActionItemType, number> = {
  overdue_followup: 50,
  due_followup:     35,
  overdue_task:     30,
  stale_contact:    20,
  due_task:         15,
};
```

Overdue items outrank due items. Follow-ups outrank tasks at equivalent
overdue state, because a follow-up is specifically a relationship
touchpoint Alex already committed to.

### By tier

```ts
const TIER_WEIGHT: Record<NonNullable<ContactTier>, number> = {
  A: 40,
  B: 25,
  C: 10,
  P: 5,
};
```

A-tier agents get the biggest bump. P (prospect) gets the smallest; they
are the sphere/prospect tier and not revenue-generating yet.

### Stale thresholds

```ts
const STALE_THRESHOLD_DAYS: Record<NonNullable<ContactTier>, number> = {
  A: 7,
  B: 14,
  C: 30,
  P: 60,
};
```

A-tier goes stale after 7 days of silence. P-tier after 60. These values
drive `buildStaleActions` to decide which contacts count as "stale enough
to appear in the action list."

## Core formula (lines 35 to 42)

```ts
export function scoreAction(item: Pick<ActionItem, "type" | "contactTier" | "contactHealthScore" | "daysOverdue">): number {
  const typeScore = TYPE_WEIGHT[item.type];
  const tierScore = item.contactTier ? TIER_WEIGHT[item.contactTier] : 0;
  const overdueBonus = Math.min(item.daysOverdue * 2, 20);
  const healthScoreBonus = Math.min(item.contactHealthScore / 10, 10);

  return Math.min(Math.round(typeScore + tierScore + overdueBonus + healthScoreBonus), 100);
}
```

Components:

- **typeScore** (0 to 50): from the TYPE_WEIGHT table
- **tierScore** (0 to 40): from the TIER_WEIGHT table
- **overdueBonus** (0 to 20): 2 points per day overdue, capped at 20
  (ten days of overdue saturation)
- **healthScoreBonus** (0 to 10): health_score / 10, capped at 10. A
  hot contact with score 100 gets the full +10 nudge. A cold contact
  with score 0 gets nothing.

Max possible score: 50 + 40 + 20 + 10 = 120, clamped to 100.
Typical range: 50 to 90.

## ActionItem type (defined in `src/lib/types.ts`)

Fields referenced by the scorer:

- `type` -- one of `overdue_followup`, `due_followup`, `overdue_task`,
  `stale_contact`, `due_task`
- `contactTier` -- A, B, C, or P (nullable, treated as 0 tier score)
- `contactHealthScore` -- 0 to 100
- `daysOverdue` -- integer, can be 0 for due items

## Why this exists alongside TaskListWidget

`TaskListWidget` (dashboard) uses fixed bucket priority (bucket 1 before
bucket 2 before bucket 3, etc.) from the Linear Focus model.

`/actions` page uses a single ranked list across types via `scoreAction`.
Alex can pick the ranking model that matches the task. Dashboard = "what
should I do next, grouped by concern." Actions page = "rank every open
item end-to-end."

The two systems are not redundant. They answer different questions.

## Dependencies

- `date-fns` -- `differenceInDays`, `parseISO`, `startOfToday`
- `./types` -- `ActionItem`, `ActionItemType`, `Contact`, `ContactTier`,
  `FollowUp`, `Task`

## Known constraints

- Pure functions, zero side effects. Safe to unit test without a
  Supabase mock.
- `contactTier = null` drops the tier contribution but still scores the
  item. A tier-less contact with an overdue follow-up still gets 50
  (typeScore) + 0 + overdue bonus.
- `daysOverdue` caps at 10 useful days. After 10 days overdue, the
  score stops moving on that axis. This prevents year-old forgotten
  follow-ups from dominating the queue; they will still rank highly
  because of typeScore, but they will not monopolize the list.

## Example usage (from actions/page.tsx)

```ts
const [followUpsRes, tasksRes, contactsRes, interactionsRes] =
  await Promise.all([/* queries */]);

const followUpItems = buildFollowUpActions(followUpsRes.data ?? []);
const taskItems = buildTaskActions(tasksRes.data ?? []);

// Build last-interaction lookup: contactId -> most recent date
const lastInteractions: Record<string, string> = {};
for (const row of interactionsRes.data ?? []) {
  if (!lastInteractions[row.contact_id]) {
    lastInteractions[row.contact_id] = row.occurred_at;
  }
}
```

Each builder returns an `ActionItem[]`. The page concatenates them,
sorts by `score` descending, and renders.
