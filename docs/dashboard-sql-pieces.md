# Dashboard SQL Pieces (1 through 4)

## What it does

Four idempotent SQL files that migrate the live Supabase DB into the shape
required by the `dashboard.md` architecture contract. They are the source of
truth for the `contacts.health_score` rename, the `deals` table, the
`agent_relationship_health` materialized view, the smart coalesce view
`agent_health`, and the `follow_ups` table.

## Where it lives

- `/Users/alex/crm/supabase/dashboard-piece1-rename-temperature.sql`
- `/Users/alex/crm/supabase/dashboard-piece2-add-infrastructure.sql`
- `/Users/alex/crm/supabase/dashboard-piece3-smart-health-view.sql`
- `/Users/alex/crm/supabase/dashboard-piece4-follow-ups-table.sql`

## Piece 1: temperature rename

Single statement at line 27 of piece 1:

```sql
ALTER TABLE contacts RENAME COLUMN temperature TO health_score;
```

Non-destructive rename. Preserves values, indexes, and constraints. Must run
after the 13 TypeScript files that referenced `contacts.temperature` have been
updated to read `contacts.health_score`. Verification SELECT at lines 30 to 48.

Rollback: `ALTER TABLE contacts RENAME COLUMN health_score TO temperature;`

## Piece 2: infrastructure (lines 1 to 431)

Adds, in this order:

1. **Defensive `contacts.user_id` check** (lines 38 to 54). Adds the column if
   it does not exist in the live DB, because `phase4-migration.sql` and
   `schema.sql` disagree. Logs a NOTICE with the manual backfill command.
2. **`opportunities` security fix** (lines 61 to 92). Adds `user_id`,
   `deleted_at`, RLS enable, and the `Users manage own opportunities` policy
   (`USING (user_id = auth.uid())`). Closes the gap noted in project memory as
   "Phase 2.1 contacts RLS lockdown."
3. **`deals` table** (lines 102 to 186). A distinct table from `opportunities`,
   representing signed contracts. Columns include `opportunity_id` (conversion
   history), `contact_id`, property fields, `sale_price`, `earnest_money`,
   `escrow_number`, `title_company` (defaults to `Great American Title
   Agency`), `lender_name`, `lender_partner_id`, stage enum, and date fields.
   Enum `deal_stage` is: `under_contract`, `in_escrow`, `clear_to_close`,
   `closed`, `fell_through`. Indexes at lines 172 to 181 cover the most
   important dashboard query patterns (active by user, by contact, by stage,
   by close date, by lender).
4. **`agent_relationship_health` materialized view** (lines 201 to 303).
   Implements the Section 1 algorithm from `dashboard.md`:
   recency 40% + deal trend 30% + frequency 20% + responsiveness 10%.
   Output column is intentionally named `computed_health_score` to avoid
   collision with the manually set `contacts.health_score` from piece 1.
   CTEs: `interaction_stats`, `deal_stats`, `component_scores`.
   Final select adds `trend_direction` (up/down/flat based on 90d deal count
   delta) and `computed_at` timestamp. Unique index on `contact_id` is
   required for `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
5. **Refresh function and triggers** (lines 318 to 342). Function
   `refresh_agent_relationship_health()` is `SECURITY DEFINER`, called from
   statement-level triggers on `interactions` and `deals`. Synchronous
   refresh is acceptable at Alex's ~25 agent scale. If interaction volume
   grows past ~1000 events/day, switch to a debounced `pg_cron` job.
6. **Supabase Realtime publication** (lines 349 to 383). Idempotently adds
   `interactions`, `opportunities`, `deals`, and `tasks` to the
   `supabase_realtime` publication so client-side `postgres_changes` channels
   can subscribe.

## Piece 3: smart coalesce view `agent_health` (lines 35 to 72)

```sql
CREATE OR REPLACE VIEW agent_health WITH (security_invoker = true) AS
SELECT
  c.id AS contact_id,
  c.user_id,
  COALESCE(NULLIF(c.health_score, 0), arh.computed_health_score, 0) AS health_score,
  CASE
    WHEN c.health_score IS NOT NULL AND c.health_score > 0 THEN 'manual'
    WHEN arh.computed_health_score IS NOT NULL THEN 'computed'
    ELSE 'none'
  END AS health_score_source,
  arh.computed_health_score,
  arh.recency_score,
  arh.deal_trend_score,
  arh.frequency_score,
  arh.responsiveness_score,
  arh.trend_direction,
  arh.days_since_contact,
  arh.last_contact_at,
  arh.total_interactions,
  arh.interactions_30d,
  arh.deals_closed_90d,
  arh.active_deals,
  arh.computed_at AS health_computed_at
FROM contacts c
LEFT JOIN agent_relationship_health arh ON arh.contact_id = c.id
WHERE c.deleted_at IS NULL;
```

Manual override wins. The computed value is the fallback. `security_invoker`
inherits RLS from the underlying `contacts` table, so the `auth.uid() =
user_id` policy applies transparently.

Revision 2 trimmed the column list to only `id`, `user_id`, `health_score`,
and `deleted_at` after Piece 3 v1 failed referencing `contacts.company`
(column does not exist in live DB). Widgets that need `first_name`, `email`,
etc., join this view to `contacts` themselves.

## Piece 4: `follow_ups` table (lines 1 to 274)

Creates the source of truth for Linear Focus bucket #1 (overdue follow-ups).
The original `schema.sql` declared `follow_ups` but the live DB never got it,
so `TaskListWidget` and `/actions/page.tsx` were querying a missing table.

Highlights:

- Enum `follow_up_status`: `pending`, `completed`, `snoozed`, `cancelled`
- Columns include `reason`, `due_date`, `priority` (low/medium/high),
  `snoozed_until`, `completed_via_interaction_id`, `created_via` (manual,
  backfill, morning-briefing, etc.), and `deleted_at`
- RLS: `Users manage own follow_ups` with `user_id = auth.uid()`
- Partial indexes (lines 121 to 131) tuned for bucket #1 query:
  `idx_follow_ups_user_pending`, `idx_follow_ups_contact`,
  `idx_follow_ups_snoozed`
- Trigger `follow_ups_updated_at` reuses `update_updated_at()` from
  `schema.sql`
- Added to `supabase_realtime` publication
- Backfill block (lines 175 to 213) inserts one pending follow-up per contact
  whose `next_action_date` is set, mapping tier A/B/C to priority
  high/medium/low. Idempotent: re-runs are safe because it checks
  `NOT EXISTS (... created_via = 'backfill_from_contacts' ...)`.

## Data flow

```
contacts.temperature  --(piece 1)-->  contacts.health_score (manual gut call)
                                           |
interactions + deals ---> agent_relationship_health (computed, MV)
                              |
                              v
                       agent_health view  <--  widgets read from this
                       (coalesced output)

contacts.next_action_date --(piece 4 backfill)--> follow_ups table
                                                       |
                                                       v
                                          TaskListWidget bucket 1 reads here
```

## Dependencies

- Supabase Postgres 15+ (tested on hosted Supabase)
- `update_updated_at()` function from `schema.sql` must already exist for
  piece 2 and 4 triggers
- `supabase_realtime` publication must already exist (Supabase default)

## Known constraints

From `.claude/rules/dashboard.md`:

- Relationship health scoring lives in the materialized view, never
  client-side
- Never rename `agents`/`deals` back to table names that collide with CRM
  vocab; the DB uses `contacts` and `opportunities` plus the new `deals`
- RLS is per-user on every dashboard table; no mixed-owner reads

From `standing-rules.md`:

- No hard deletes. Every table includes `deleted_at timestamptz`. Rollback
  comments in piece 4 explicitly set `deleted_at = now()` instead of `DELETE`.

## Example: top 8 agents for the Hot Leaders widget

```sql
SELECT ah.contact_id,
       ah.health_score,
       ah.trend_direction,
       c.first_name,
       c.last_name,
       c.tier
FROM agent_health ah
JOIN contacts c ON c.id = ah.contact_id
WHERE c.user_id = auth.uid()
  AND c.tier IN ('A', 'B')
ORDER BY ah.health_score DESC NULLS LAST
LIMIT 8;
```

## Running order

Piece 1 -> Piece 2 -> Piece 3 -> Piece 4. Each depends on the previous. All
four are idempotent and safe to re-run.
