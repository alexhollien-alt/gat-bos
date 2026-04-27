# Phase 004: Slice 2C -- Tasks + Opportunities Merge, Interactions View - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Source:** Slice 2C starter block (session-verified, all pre-conditions confirmed 2026-04-24)

<domain>
## Phase Boundary

Pure plumbing session: schema migrations and TypeScript updates only. No new UI surfaces,
no new routes, no changes to activity_events schema.

- Extend the tasks table with 4 new columns (type, source, due_reason, action_hint) + CHECK constraint + index
- Merge follow_ups rows (currently 0) into tasks with type='follow_up', then DROP follow_ups
- Add 13 deal-specific columns to opportunities, merge deals rows (currently 0) into opportunities, then DROP deals
- Rename interactions to interactions_legacy; create a VIEW named interactions (UNION ALL legacy rows + activity_events)
- Add idempotent DROPs for already-gone spine tables as a safety no-op
- Update TypeScript: FollowUp callers -> tasks path; DealRow callers -> opportunities; promote.ts -> interactions_legacy; contact-activity.ts -> tasks for follow-ups
- Update SCHEMA.md, BUILD.md, BLOCKERS.md; commit; tag slice-2c-complete; open PR

</domain>

<decisions>
## Implementation Decisions

### Branch
- git checkout -b gsd/004-slice-2c-tasks-opportunities-interactions before any file changes

### Pre-condition findings (verified 2026-04-24)
- follow_ups: EXISTS, 0 rows. INSERT is no-op; DROP still fires.
- deals: EXISTS, 0 rows. INSERT is no-op; DROP still fires.
- interactions: EXISTS, 2 rows. MUST rename to interactions_legacy to preserve data.
- tasks: EXISTS, 0 rows.
- opportunities: EXISTS, 2 rows. MUST be preserved -- no destructive ops.
- Spine tables (commitments, signals, focus_queue, cycle_state): already GONE. DROPs are no-ops.

### tasks -- 4 columns to ADD (all missing from current schema):
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type       text NOT NULL DEFAULT 'todo';
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source     text;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_reason text;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS action_hint text;

### tasks -- CHECK constraint on type:
  ALTER TABLE tasks ADD CONSTRAINT tasks_type_check
    CHECK (type IN ('todo', 'follow_up', 'commitment'));
  Use DO $$ block for IF NOT EXISTS guard on pg_constraint.

### tasks -- index:
  CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type) WHERE deleted_at IS NULL;

### follow_ups -> tasks column mapping (0 rows; INSERT is no-op; DROP still fires):
  id, user_id, contact_id -> direct copy
  COALESCE(reason, 'Follow up') -> title
  reason -> due_reason
  due_date::timestamptz -> due_date  [follow_ups.due_date is DATE; tasks.due_date is timestamptz]
  priority -> priority  (both text)
  CASE status::text WHEN 'pending' THEN 'open' WHEN 'completed' THEN 'completed' ELSE 'cancelled' END -> status
  snoozed_until -> snoozed_until
  completed_at -> completed_at
  created_at, updated_at, deleted_at -> direct copy
  'follow_up'  (literal) -> type
  'follow_ups' (literal) -> source
  ON CONFLICT (id) DO NOTHING

  After INSERT: DROP TABLE IF EXISTS follow_ups CASCADE;

### opportunities -- 13 columns to ADD (all nullable; deals has them, opportunities lacks them):
  buyer_name text, seller_name text, earnest_money numeric, commission_rate numeric,
  escrow_company text, escrow_officer text, title_company text, lender_name text,
  lender_partner_id uuid, contract_date date, escrow_open_date date,
  scheduled_close_date date, actual_close_date date
  All added with IF NOT EXISTS.

### deals -> opportunities column mapping (0 rows; INSERT is no-op; DROP still fires):
  id, user_id, contact_id -> direct copy
  property_address, property_city, property_state, property_zip -> direct copy
  sale_price, escrow_number, notes, created_at, updated_at, deleted_at -> direct copy
  buyer_name, seller_name, earnest_money, commission_rate, escrow_company,
  escrow_officer, title_company, lender_name, lender_partner_id -> new columns (direct copy)
  contract_date -> contract_date
  scheduled_close_date -> scheduled_close_date
  actual_close_date -> actual_close_date
  Stage mapping (deal_stage -> opportunity_stage):
    CASE d.stage::text
      WHEN 'clear_to_close' THEN 'in_escrow'::opportunity_stage
      ELSE d.stage::text::opportunity_stage
    END
    ['clear_to_close' is in deal_stage but NOT in opportunity_stage; maps to 'in_escrow']
  opportunity_id: SKIP (FK back to opportunities, not meaningful for the merge)
  ON CONFLICT (id) DO NOTHING

  After INSERT: DROP TABLE IF EXISTS deals CASCADE;

### Spine idempotent DROPs (already gone; safe no-ops included for correctness):
  DROP TABLE IF EXISTS signals     CASCADE;
  DROP TABLE IF EXISTS focus_queue  CASCADE;
  DROP TABLE IF EXISTS cycle_state  CASCADE;
  DROP TABLE IF EXISTS commitments  CASCADE;

### interactions view design:
  Step 1: ALTER TABLE interactions RENAME TO interactions_legacy;
  Step 2: CREATE OR REPLACE VIEW public.interactions AS
    -- Part A: preserved legacy rows (the 2 existing rows, contact-activity.ts history intact)
    SELECT
      il.id,
      il.user_id,
      il.contact_id,
      il.type::text      AS type,
      il.summary,
      il.occurred_at,
      il.created_at,
      il.direction,
      il.duration_minutes,
      NULL::timestamptz  AS deleted_at
    FROM public.interactions_legacy il
    UNION ALL
    -- Part B: Slice 1+ rows written via writeEvent() with interaction verbs
    SELECT
      ae.id,
      ae.user_id,
      (ae.context->>'contact_id')::uuid       AS contact_id,
      REPLACE(ae.verb, 'interaction.', '')     AS type,
      COALESCE(ae.context->>'summary',
               ae.context->>'note', '')        AS summary,
      ae.occurred_at,
      ae.created_at,
      ae.context->>'direction'                AS direction,
      (ae.context->>'duration_minutes')::int  AS duration_minutes,
      ae.deleted_at
    FROM public.activity_events ae
    WHERE ae.verb LIKE 'interaction.%'
      AND ae.deleted_at IS NULL;

  Step 3: Verify typecheck passes, then:
    DROP TABLE IF EXISTS interactions_legacy CASCADE;
    (Only drop if typecheck passes. If typecheck fails, keep interactions_legacy and log blocker.)

  CRITICAL: Read all 14 TS caller files before finalizing the view SQL. Adjust the column
  projection to cover every column the app reads. If gaps exist, log to BLOCKERS.md.

  NOTE: TypeScript's Interaction interface (src/lib/types.ts:140) defines:
    { id, user_id, contact_id, type: InteractionType, summary, occurred_at, created_at, contacts? }
  The view exposes all these (type as text, compatible for runtime even if not exact enum type).
  direction and duration_minutes are also exposed for completeness.

### promote.ts interactions INSERT -- critical change:
  Current: adminClient.from("interactions").insert({ user_id, contact_id, type, summary })
  After migration: interactions is a view (not directly insertable).
  Fix in Task 6: change .from("interactions") -> .from("interactions_legacy")
  This keeps the write going to an actual table (Part A of the view surfaces it).
  BLOCKERS.md note: promote.ts still writes to interactions_legacy; migrate to writeEvent() later.

### contact-activity.ts -- follow_ups callers:
  The buildActivityFeed function receives a followUps: FollowUp[] argument.
  Its callers (contacts/[id]/page.tsx and others) query the follow_ups table.
  After DROP, those callers must switch to: tasks WHERE type = 'follow_up'.
  Task 6 must update callers to query tasks with type='follow_up' and cast result to FollowUp shape
  (or accept Task rows and update buildActivityFeed's parameter type).

### Migration file layout:
  File 1: 20260424100000_slice2c_tasks_extend.sql
    Covers: tasks ADD 4 columns + CHECK + INDEX; follow_ups INSERT + DROP;
            opportunities ADD 13 columns; deals INSERT + DROP; spine DROPs
  File 2: 20260424110000_slice2c_interactions_view.sql   (timestamp > File 1 for apply order)
    Covers: interactions RENAME to interactions_legacy; CREATE VIEW interactions

### Migration push strategy:
  Try: cd ~/crm && supabase db push --linked
  If Docker not running / CLI fails: write ALL SQL to ~/Desktop/PASTE-INTO-SUPABASE-slice2c.sql and STOP.

### Acceptance gate 11-point checklist (from starter block):
  1. grep migration for type text / due_reason / action_hint ADD COLUMN lines
  2. grep migration for tasks_type_check constraint
  3. follow_ups and deals return 0 rows from pg_tables
  4. interactions is VIEW type in information_schema.tables
  5. tasks has all 4 new columns in information_schema.columns
  6. spine tables return 0 rows from pg_tables
  7. opportunities row count >= 2 (original rows preserved, no data loss)
  8. tasks WHERE type='follow_up' count >= 0 (was 0 follow_ups, so >=0)
  9. git tag slice-2c-complete present
  10. pnpm typecheck exit 0
  11. pnpm build exit 0

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tasks system (READ BEFORE TOUCHING)
- `src/lib/types.ts` lines 155-175 -- Task interface (note: due_date is timestamptz, status is string)
- `src/lib/types.ts` lines 174-185 -- FollowUp interface (reason, due_date as string, status: FollowUpStatus)

### follow_ups callers (all must be migrated to tasks WHERE type='follow_up')
- `src/app/(app)/follow-ups/page.tsx`
- `src/components/follow-ups/follow-up-list.tsx`
- `src/components/follow-ups/follow-up-form.tsx`
- `src/lib/action-scoring.ts`
- `src/lib/contact-activity.ts` (buildActivityFeed receives followUps: FollowUp[])
- `src/app/(app)/contacts/[id]/page.tsx`
- `src/app/(app)/actions/page.tsx`
- `src/components/dashboard/quick-actions.tsx`
- `src/components/dashboard/task-list.tsx`
- `src/lib/captures/parse.ts`
- `src/lib/validations.ts`
- `src/app/(app)/captures/captures-client.tsx`

### deals callers (only 1 file)
- `src/components/dashboard/task-list.tsx` -- check for DealRow reference

### interactions callers (all 14 -- READ BEFORE WRITING THE VIEW):
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/dashboard/dashboard-client.tsx`
- `src/app/(app)/contacts/page.tsx`
- `src/app/(app)/contacts/[id]/page.tsx`
- `src/app/(app)/actions/page.tsx`
- `src/app/(app)/analytics/page.tsx`
- `src/app/api/intake/route.ts`
- `src/app/api/webhooks/resend/route.ts`
- `src/components/interactions/interaction-modal.tsx`
- `src/components/dashboard/recent-interactions.tsx`
- `src/components/dashboard/quick-actions.tsx`
- `src/components/dashboard/task-list.tsx`
- `src/lib/captures/promote.ts`  [CRITICAL: INSERTs into interactions -- see promote.ts decision]
- `src/lib/contact-activity.ts`  [reads interactions for activity feed]

### Verified database schemas (2026-04-24)
- tasks (15 cols): id, contact_id, title, description, due_date (timestamptz), priority (default 'medium'), status (default 'open'), is_recurring, recurrence_rule, completed_at, snoozed_until, created_at, updated_at, deleted_at, user_id -- 0 rows
- follow_ups (14 cols): id, user_id, contact_id, reason (NOT NULL), due_date (DATE NOT NULL), status (follow_up_status: pending/completed/skipped), priority, snoozed_until, completed_at, completed_via_interaction_id, created_via, created_at, updated_at, deleted_at -- 0 rows
- deals (28 cols): id, user_id, opportunity_id, contact_id, property_address (NOT NULL), property_city, property_state (default 'AZ'), property_zip, buyer_name, seller_name, sale_price, earnest_money, commission_rate, escrow_number, escrow_company, escrow_officer, title_company, lender_name, lender_partner_id, stage (deal_stage enum), contract_date, escrow_open_date, scheduled_close_date, actual_close_date, notes, created_at, updated_at, deleted_at -- 0 rows
- opportunities (17 cols): id, contact_id, property_address (NOT NULL), property_city, property_state (default 'AZ'), property_zip, sale_price, stage (opportunity_stage enum), escrow_number, opened_at, expected_close_date, closed_at, notes, created_at, updated_at, user_id, deleted_at -- 2 rows (PRESERVE)
- interactions (9 cols): id, user_id, contact_id, type (interaction_type enum), summary (NOT NULL), occurred_at, created_at, direction, duration_minutes -- 2 rows, NO deleted_at, NO updated_at

### Enum facts
- deal_stage: under_contract, in_escrow, clear_to_close, closed, fell_through
- opportunity_stage: prospect, under_contract, in_escrow, closed, fell_through
  ['clear_to_close' is ONLY in deal_stage -- map to 'in_escrow' when merging]
- interaction_type: call, text, email, meeting, broker_open, lunch, note, email_sent, email_received, event
- follow_up_status: pending, completed, skipped

### Migration naming and pattern
- supabase/migrations/[YYYYMMDDHHMMSS]_slug.sql
- Wrap in BEGIN; ... COMMIT; for atomicity
- File 2 timestamp MUST be higher than File 1 (Supabase applies by filename order)
- Pattern reference: supabase/migrations/20260423120000_slice2b_captures_merge.sql

</canonical_refs>

<specifics>
## Specific Ideas

### follow_ups.due_date DATE -> tasks.due_date timestamptz cast
  `due_date::timestamptz` converts date to midnight UTC on that day. No data precision loss
  since follow_ups stores day granularity only.

### deals.stage enum cast
  deal_stage and opportunity_stage are different Postgres enums. Must cast via text intermediate:
    CASE d.stage::text WHEN 'clear_to_close' THEN 'in_escrow'::opportunity_stage
    ELSE d.stage::text::opportunity_stage END
  Since deals has 0 rows, this is syntactically required but never actually executes.

### interactions view -- type column as text
  The view exposes type as text (cast from interaction_type enum for Part A, text from REPLACE
  for Part B). TypeScript's Interaction.type is typed as InteractionType (a union of string literals).
  At runtime, string values still match -- TypeScript doesn't enforce at DB boundary.
  No type change to Interaction interface required unless a strict discriminated union check exists.

### promote.ts INSERT -> interactions_legacy
  Change: adminClient.from("interactions") -> adminClient.from("interactions_legacy")
  This is the minimal-risk fix. The view's Part A surfaces interactions_legacy rows unchanged.
  Future cleanup: migrate to writeEvent() in a later slice (log to BLOCKERS.md).

### contact-activity.ts followUps parameter
  Callers pass followUps: FollowUp[] to buildActivityFeed. After DROP, callers must query
  tasks WHERE type = 'follow_up' AND status = 'completed'.
  The Task interface has: id, user_id, contact_id, title, status, created_at.
  The FollowUp interface has: id, user_id, contact_id, reason, due_date, status, completed_at, created_at.
  Since buildActivityFeed only reads i.reason and i.created_at from FollowUp items, the simplest
  fix is to map Task rows to a shape compatible with FollowUp before passing. Or change
  buildActivityFeed to accept Task[] for the follow-ups arm and derive labels from title.
  The executor must read buildActivityFeed's full FollowUp usage before deciding.

### interactions_legacy DROP guard
  Only drop interactions_legacy after typecheck passes with the view in place.
  If typecheck fails, keep interactions_legacy and log the blocker -- the view is incomplete.
  The drop is part of Migration File 2 but guarded by the typecheck step.

</specifics>

<deferred>
## Deferred Ideas

- Route thinning (Slice 3)
- Ticket unification (Slice 3)
- /today card rebuilds for deleted spine components (existing BLOCKERS.md items)
- Any new UI pages, components, or route changes
- Changes to contacts, projects, events, captures, or activity_events tables
- Gmail integration or email parsing changes
- Migrating promote.ts from interactions_legacy INSERT to writeEvent() (log to BLOCKERS.md)

</deferred>

---

*Phase: 004-slice-2c-tasks-opportunities-interactions*
*Context gathered: 2026-04-24 via Slice 2C starter block (session-verified)*
