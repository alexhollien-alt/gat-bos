# agent_relationship_health Materialized View

## What it does

Computes a 0-to-100 relationship health score per contact from interactions
and deals history. Implements the Section 1 algorithm from
`.claude/rules/dashboard.md`. It is the server-side origin for every
"health," "temperature," and "going cold" display in the CRM dashboard.

## Where it lives

Defined in `/Users/alex/crm/supabase/dashboard-piece2-add-infrastructure.sql`
at lines 201 to 303. Refresh triggers at lines 318 to 339. Read-side wrapper
view `agent_health` defined in
`/Users/alex/crm/supabase/dashboard-piece3-smart-health-view.sql`.

## Algorithm

Per Section 1 of `dashboard.md`:

| Component | Weight | Logic |
|---|---|---|
| Recency | 40% | 100 at <=7 days since last contact. Linear decay to 0 at 60 days. |
| Deal trend | 30% | Compares deals closed in last 90 days vs previous 90 days. Zero-to-some jump = 100, zero-to-zero = 50, ratio otherwise. |
| Frequency | 20% | 10 interactions in 30 days caps to 100 (cap at 10x multiplier). |
| Responsiveness | 10% | Percent of 90-day interactions that are `direction = 'inbound'`. |

Final score: `ROUND(0.40*recency + 0.30*deal_trend + 0.20*frequency + 0.10*responsiveness)`, clamped to 0..100.

## CTE structure

```
interaction_stats  --  per-contact: total, 30d, 90d, inbound_90d, last_contact_at
deal_stats         --  per-contact: closed_90d, closed_prev_90d, active_deals
component_scores   --  joins contacts to the above, computes each sub-score
```

Final SELECT at lines 271 to 303 exposes: `contact_id`, `user_id`,
`days_since_contact`, `last_contact_at`, `recency_score`, `deal_trend_score`,
`frequency_score`, `responsiveness_score`, `computed_health_score`,
`trend_direction`, `total_interactions`, `interactions_30d`,
`deals_closed_90d`, `active_deals`, `computed_at`.

## Naming discipline

The final column is **`computed_health_score`**, not `health_score`. This is
deliberate. `contacts.health_score` holds Alex's manual gut call (renamed
from `temperature` in piece 1). The two must not collide. The
`agent_health` view in piece 3 coalesces them: manual wins when set and
non-zero, computed fills the gap.

## Refresh strategy

Statement-level triggers on `interactions` and `deals` call
`refresh_agent_relationship_health()` after INSERT, UPDATE, or DELETE. The
function runs `REFRESH MATERIALIZED VIEW CONCURRENTLY agent_relationship_health;`
which requires the unique index `idx_arh_contact`.

Synchronous refresh is acceptable at Alex's current scale (~25 core agents,
~126 total contacts). If interaction volume grows past roughly 1000 events
per day, switch to a debounced refresh via `pg_cron` running every N minutes
to avoid write amplification.

The initial population runs at the bottom of piece 2
(`REFRESH MATERIALIZED VIEW agent_relationship_health;`, line 342).

## Indexes

- `idx_arh_contact` -- `UNIQUE (contact_id)`. Required for concurrent refresh.
- `idx_arh_user_score` -- `(user_id, computed_health_score DESC)`. Top-N
  queries for the Hot Leaders widget.
- `idx_arh_cold` -- `(user_id, days_since_contact DESC)
  WHERE days_since_contact > 14`. Going-cold bucket query.

## How widgets consume it

Widgets read from `agent_health` (the coalesce view), never
`agent_relationship_health` directly. Example from
`/Users/alex/crm/src/components/dashboard/task-list.tsx` at lines 219 to 233:

```ts
const { data, error } = await supabase
  .from("agent_health")
  .select(
    "contact_id, health_score, days_since_contact, trend_direction, contacts(id, first_name, last_name, tier, phone, email)"
  )
  .eq("user_id", userId!)
  .or("trend_direction.eq.down,days_since_contact.gte.21")
  .order("days_since_contact", { ascending: false, nullsFirst: false })
  .limit(20);
```

## Dependencies

- `contacts` (with `user_id`, `deleted_at`, optional `health_score`)
- `interactions` (with `contact_id`, `occurred_at`, `direction`)
- `deals` (with `contact_id`, `stage`, `actual_close_date`, `deleted_at`)
- `update_updated_at()` function for the deals updated_at trigger
- Supabase Realtime publication for live invalidation of widget caches

## Known constraints

Per `dashboard.md`:

- Never compute health scores client-side. The materialized view is the only
  valid source.
- The Today View reads tasks via bucket priority, never creation date.
- Client code subscribes to `interactions` changes through Supabase Realtime
  and invalidates TanStack Query caches. It does not update component state
  directly from a realtime event.

## Verification queries

```sql
-- Populated?
SELECT count(*) FROM agent_relationship_health;

-- Top 10:
SELECT contact_id, computed_health_score, recency_score,
       deal_trend_score, frequency_score, responsiveness_score,
       trend_direction
FROM agent_relationship_health
ORDER BY computed_health_score DESC
LIMIT 10;

-- Realtime publication sanity:
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```
