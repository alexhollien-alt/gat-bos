# Phase 005: Slice 3 -- Interactions writeEvent Migration + Route Thinning - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Source:** Slice 2C `<deferred>` block + 3 BLOCKERS.md entries opened on 2026-04-24

<domain>
## Phase Boundary

Plumbing-only continuation of Slice 2A/2B/2C. Closes the canonical-write-path
gap on `interactions` and removes the `/follow-ups` route surface that became
redundant after the follow_ups -> tasks merge.

- Add `tasks.linked_interaction_id uuid` column for cross-entity audit linkage
- Migrate 6 INSERT call sites from `interactions_legacy` direct writes to `writeEvent()`
- Backfill 2 existing `interactions_legacy` rows into `activity_events`
- Rewrite the `interactions` VIEW to drop Part A (UNION ALL legacy) -- view becomes
  pure projection over `activity_events WHERE verb LIKE 'interaction.%'`
- DROP TABLE `interactions_legacy` CASCADE
- Flip 2 Realtime subscriptions from `table:'interactions_legacy'` to
  `table:'activity_events'` with verb filter
- Delete `/follow-ups` route, redirect `/follow-ups -> /tasks?type=follow_up`,
  remove sidebar entry, update command-palette
- Add type filter UI to `/tasks` page (respect `?type=` query param)
- Update SCHEMA.md, BUILD.md, BLOCKERS.md; commit; tag slice-3-complete; open PR

OUT OF SCOPE: /today component rebuilds (5 deleted spine components -- routed
to phase 006 build session); ticket unification (left material_requests
separate per R2 ruling); any new UI surfaces or feature work.

</domain>

<decisions>
## Implementation Decisions

### Branch
- `git checkout -b gsd/005-slice-3-interactions-routes-cleanup` before any file changes

### R1 ruling: audit linkage shape
- `tasks.linked_interaction_id uuid` column added (nullable, FK to activity_events.id).
- Cheap to add, easy to query for "show me the interaction that completed this task" UI.
- Activity-events context route rejected: harder query path, no measurable architectural win.

### R2 ruling: ticket unification
- DROPPED from Slice 3. `material_requests` stays separate.
- Tickets have their own production lifecycle (design ticket -> Cypher -> completed)
  that does not benefit from absorption into the tasks table.

### R3 ruling: /follow-ups route thinning
- Full delete + 308 redirect to /tasks?type=follow_up. Updates sidebar + command-palette.
- Components in `src/components/follow-ups/` (form + list) are KEPT -- still used by
  contact detail page Tabs and dashboard quick-actions. They do not depend on the
  /follow-ups route.

### ActivityVerb enum extension (TYPE-LEVEL CHANGE in src/lib/activity/types.ts)
- Current: enum lacks `'interaction.*'` verbs. Migrations docstring references them but
  the TS union does not enumerate them.
- Add 10 verbs to ActivityVerb union matching interaction_type enum:
  `'interaction.call' | 'interaction.text' | 'interaction.email' | 'interaction.meeting' |
   'interaction.broker_open' | 'interaction.lunch' | 'interaction.note' |
   'interaction.email_sent' | 'interaction.email_received' | 'interaction.event'`
- The existing `'interaction.backfilled'` verb stays as-is (used by W3 backfill).

### Server endpoint for client-side interaction logging
- Three of six call sites are client components and cannot call writeEvent() directly
  (writeEvent uses adminClient/service-role). Build a thin POST endpoint at
  `/api/activity/interaction` that accepts `{ contact_id, type, summary, direction?,
   duration_minutes?, occurred_at? }`, looks up the authenticated user, and calls
  writeEvent server-side.
- Server-side call sites (promote.ts, intake/route.ts, webhooks/resend/route.ts) call
  writeEvent() directly -- no endpoint round-trip needed.

### Six INSERT call sites -> writeEvent migration plan

| # | File | Line | Side | Migration target |
|---|------|------|------|------------------|
| 1 | src/lib/captures/promote.ts | 381 | server (adminClient) | direct writeEvent({ verb: `interaction.${type}`, object: { table: 'contacts', id: contact_id }, context: { summary, direction?, source: 'capture' } }) |
| 2 | src/app/(app)/actions/page.tsx | 119 | client (browser supabase) | POST /api/activity/interaction |
| 3 | src/components/dashboard/task-list.tsx | 427 | client (mutation) | POST /api/activity/interaction; capture returned event id; UPDATE tasks.linked_interaction_id |
| 4 | src/components/dashboard/task-list.tsx | 533 | client (mutation) | POST /api/activity/interaction |
| 5 | src/components/interactions/interaction-modal.tsx | 79 | client (form) | POST /api/activity/interaction; pass occurred_at |
| 6 | src/app/api/intake/route.ts | 274 | server (adminClient) | direct writeEvent({ verb: 'interaction.note', context: { summary, direction: 'inbound', source: 'intake' } }) |
| 7 | src/app/api/webhooks/resend/route.ts | 134 | server (supabase service) | direct writeEvent({ verb: 'interaction.email', context: { summary, direction: 'inbound', source: 'resend_webhook' } }) |

(Count: 6 sites + task-list.tsx counts twice = 7 INSERTs in 6 files. BLOCKERS.md
counts these as 6.)

### object.table choice for writeEvent calls
- Each interaction is "about" a contact -- use `object: { table: 'contacts', id: contact_id }`.
- This matches the activity_events query path: `getContactTimeline(contact_id)` already
  filters by `(object_table='contacts' AND object_id=$1) OR (context->>'contact_id' = $1)`.
- The interactions VIEW Part B uses `(ae.context->>'contact_id')::uuid AS contact_id`,
  so the migration MUST also write `context.contact_id` for VIEW compatibility during the
  W2->W4 transition.

### actorId for writeEvent calls
- Server contexts have a clear actor: capture promotion uses `OWNER_USER_ID` (Alex);
  intake first-touch uses `OWNER_USER_ID`; resend webhook uses `OWNER_USER_ID`
  (system-attributed since no user is in the request).
- Client contexts pass the authenticated user's id via the new endpoint.

### W3: legacy backfill SQL
- Read 2 rows from `interactions_legacy` via `SELECT * FROM interactions_legacy`.
- INSERT into `activity_events`:
  - `verb = 'interaction.backfilled'` (existing enum member; preserves the legacy origin)
  - `object_table = 'contacts'`, `object_id = il.contact_id`
  - `actor_id = il.user_id`
  - `occurred_at = il.occurred_at`
  - `context = jsonb_build_object('contact_id', il.contact_id, 'summary', il.summary,
    'type', il.type::text, 'direction', il.direction, 'duration_minutes',
    il.duration_minutes, 'legacy_id', il.id, 'source', 'legacy_backfill')`
- Idempotency guard: skip rows where an `activity_events` row already references
  `legacy_id = il.id` in context.

### W4: VIEW rewrite + DROP
- After W2 verifiers PASS and W3 backfill complete, rewrite VIEW to drop Part A:
  ```
  CREATE OR REPLACE VIEW public.interactions AS
    SELECT
      ae.id,
      ae.user_id,
      (ae.context->>'contact_id')::uuid AS contact_id,
      COALESCE(ae.context->>'type',
               REPLACE(ae.verb, 'interaction.', '')) AS type,
      COALESCE(ae.context->>'summary', ae.context->>'note', '') AS summary,
      ae.occurred_at,
      ae.created_at,
      ae.context->>'direction' AS direction,
      (ae.context->>'duration_minutes')::int AS duration_minutes,
      ae.deleted_at
    FROM public.activity_events ae
    WHERE ae.verb LIKE 'interaction.%'
      AND ae.deleted_at IS NULL;
  ```
  (Note: the COALESCE on `type` reads context.type first so backfilled rows preserve
  their original type even though their verb is `interaction.backfilled`.)
- After VIEW rewrite: `DROP TABLE IF EXISTS interactions_legacy CASCADE`.

### W5: route thinning
- Delete `src/app/(app)/follow-ups/page.tsx` (whole file).
- Delete `src/app/(app)/follow-ups/` directory if empty after.
- Add `next.config.js` redirects() returning `[{ source: '/follow-ups', destination:
  '/tasks?type=follow_up', permanent: true }]` (308 status).
- Edit `src/components/sidebar.tsx`:64 -- remove `{ href: '/follow-ups', label:
  'Follow-ups', icon: Clock }` line. Verify Clock import is still used elsewhere or
  drop it.
- Edit `src/components/command-palette.tsx`:144 -- change `navigate("/follow-ups")` to
  `navigate("/tasks?type=follow_up")`. Update label if needed.
- Edit `src/app/(app)/tasks/page.tsx` -- accept `?type=` query param via
  `useSearchParams()`; add type filter to the existing filter Select (Active/Completed/
  All + Type:All/Todo/Follow-up/Commitment); apply `.eq('type', filter)` to query.
- KEEP `src/components/follow-ups/follow-up-list.tsx` and `follow-up-form.tsx`
  unchanged -- still used by `contacts/[id]/page.tsx` and `dashboard/quick-actions.tsx`.

### Realtime subscription flips
- After W4 (interactions_legacy dropped), the 2 Realtime subscriptions break.
- `src/components/dashboard/task-list.tsx`:374-375 and `src/app/(app)/contacts/page.tsx`:145-146.
- Flip `table: 'interactions_legacy'` to `table: 'activity_events'`.
- Add `filter: 'verb=like.interaction.%'` if Supabase Realtime supports filter syntax;
  otherwise filter in the channel callback before invalidating queries.
- Verify activity_events is in `supabase_realtime` publication
  (`ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_events`) -- if not,
  add to migration.

### Migration file layout
- File 1: `20260425100000_slice3_tasks_linked_interaction_id.sql`
  - `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS linked_interaction_id uuid`
  - FK constraint: `REFERENCES activity_events(id) ON DELETE SET NULL`
  - Index: `CREATE INDEX IF NOT EXISTS idx_tasks_linked_interaction_id ON tasks(linked_interaction_id) WHERE linked_interaction_id IS NOT NULL`
  - Idempotent via IF NOT EXISTS guards
- File 2: `20260425110000_slice3_legacy_backfill.sql`
  - INSERT INTO activity_events SELECT FROM interactions_legacy with idempotency guard
  - Confirm 2 rows backfilled before File 3 runs
- File 3: `20260425120000_slice3_view_rewrite_drop_legacy.sql`
  - CREATE OR REPLACE VIEW interactions (Part B only)
  - DROP TABLE IF EXISTS interactions_legacy CASCADE
  - ALTER PUBLICATION supabase_realtime ADD TABLE activity_events (if not already member)
  - All wrapped in BEGIN/COMMIT

### Migration push strategy
- Try: `cd ~/crm && supabase db push --linked`
- If Docker not running / CLI fails: write ALL SQL to `~/Desktop/PASTE-INTO-SUPABASE-slice3.sql`
  and STOP for Alex to paste into Supabase SQL Editor.

### Acceptance gate (10-point checklist)
1. `tasks.linked_interaction_id` column exists in information_schema.columns
2. tasks_linked_interaction_id index present in pg_indexes
3. activity_events row count >= 2 with `context->>'source' = 'legacy_backfill'`
4. interactions VIEW returns rows from activity_events only (no UNION ALL)
5. interactions_legacy table absent from pg_tables
6. activity_events is member of supabase_realtime publication
7. `/follow-ups` returns 308 redirect to `/tasks?type=follow_up`
8. /tasks page filters correctly when `?type=follow_up` query present
9. `pnpm typecheck` exit 0
10. `pnpm build` exit 0
11. `git tag slice-3-complete` present

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Activity ledger (READ BEFORE TOUCHING)
- `src/lib/activity/writeEvent.ts` -- fire-and-forget signature: `writeEvent({ actorId, verb, object: {table, id}, context })`. Uses adminClient (server-only).
- `src/lib/activity/types.ts:5-24` -- ActivityVerb union (must extend with 10 interaction verbs in W2)
- `src/lib/activity/queries.ts` -- `getContactTimeline()` filters `(object_table='contacts' AND object_id=$1) OR (context->>'contact_id' = $1)` (verify before changing object.table)

### Six INSERT call sites (READ BEFORE WRITING WAVES)
- `src/lib/captures/promote.ts:375-410` -- legacy parsed_intent path; INSERT into interactions_legacy then writeEvent('capture.promoted'). After W2: drop the INSERT, single writeEvent('interaction.{type}') with context.summary, then a second writeEvent('capture.promoted') referencing the new event.id.
- `src/app/(app)/actions/page.tsx:112-145` -- handleComplete() logs interaction + completes source row. Client supabase. After W2: replace direct INSERT with `fetch('/api/activity/interaction', ...)`.
- `src/components/dashboard/task-list.tsx:413-481` -- completeFollowUp mutation. Client. After W2: POST endpoint, capture returned event_id, UPDATE tasks.linked_interaction_id in same mutation.
- `src/components/dashboard/task-list.tsx:521-550` -- logQuickInteraction mutation. Client. After W2: POST endpoint.
- `src/components/dashboard/task-list.tsx:374-375` -- Realtime channel `table: 'interactions_legacy'`. After W4: flip to activity_events.
- `src/components/interactions/interaction-modal.tsx:71-96` -- onSubmit form handler. Client. After W2: POST endpoint, pass occurred_at.
- `src/app/api/intake/route.ts:271-280` -- first-touch interaction. Server adminClient. After W2: writeEvent('interaction.note', context: { summary, direction: 'inbound', source: 'intake' }) directly.
- `src/app/api/webhooks/resend/route.ts:128-141` -- email open/click. Server supabase (service-role). After W2: writeEvent('interaction.email', ...).
- `src/app/(app)/contacts/page.tsx:145-146` -- Realtime channel `table: 'interactions_legacy'`. After W4: flip to activity_events.

### Route thinning sites (READ BEFORE W5)
- `src/app/(app)/follow-ups/page.tsx` -- DELETE entire file
- `src/components/sidebar.tsx:37` -- remove `/follow-ups` nav entry; check Clock icon usage elsewhere
- `src/components/command-palette.tsx:144` -- update navigate target
- `src/app/(app)/tasks/page.tsx` -- add type filter UI + URL query param
- `next.config.js` -- add redirects() function

### Files that KEEP working (do not delete)
- `src/components/follow-ups/follow-up-list.tsx` -- used by contacts/[id]/page.tsx
- `src/components/follow-ups/follow-up-form.tsx` -- used by contacts/[id]/page.tsx + dashboard/quick-actions.tsx
- `src/lib/types.ts` FollowUp interface -- still used downstream
- `src/lib/contact-activity.ts` buildActivityFeed -- already accepts Task[] for the follow-ups arm post-2C

### Verified database state (2026-04-24)
- tasks (15 cols + 4 from 2C = 19 cols): adds linked_interaction_id (col 20) in W1
- activity_events: live ledger; 200+ rows post-Slice-1; canonical write target
- interactions: VIEW (UNION ALL of interactions_legacy + activity_events WHERE verb LIKE 'interaction.%')
- interactions_legacy: 2 rows; gets backfilled in W3, dropped in W4
- supabase_realtime publication: must include activity_events before W4 (verify or add)

### Migration naming and pattern
- supabase/migrations/[YYYYMMDDHHMMSS]_slice3_*.sql
- Wrap each in BEGIN; ... COMMIT;
- Pattern reference: supabase/migrations/20260424110000_slice2c_interactions_view.sql

</canonical_refs>

<specifics>
## Specific Ideas

### writeEvent context shape for interaction verbs
Each `interaction.*` verb call should include in context:
- `contact_id` (uuid) -- REQUIRED, used by VIEW Part B and getContactTimeline
- `summary` (text) -- REQUIRED, the human-readable line
- `type` (text, optional) -- the underlying interaction_type; mirrors verb minus prefix
- `direction` ('inbound' | 'outbound', optional)
- `duration_minutes` (int, optional)
- `source` (text, optional) -- 'capture', 'intake', 'resend_webhook', 'modal', 'task_complete', 'quick_log'
- `occurred_at` not in context -- writeEvent stamps activity_events.occurred_at separately

### tasks.linked_interaction_id audit linkage usage
After W1, the completeFollowUp mutation in task-list.tsx becomes:
1. POST /api/activity/interaction -> { event_id }
2. UPDATE tasks SET status='completed', completed_at=now(), linked_interaction_id=event_id WHERE id=$1
3. activity_events row for the completion is implied by writeEvent('interaction.{type}'); a separate `task.completed` event could be emitted later (deferred).

### W2 migration order
1. Add the new POST endpoint at `src/app/api/activity/interaction/route.ts`
2. Extend ActivityVerb union in types.ts
3. Migrate server-side callers (promote.ts, intake/route.ts, webhooks/resend/route.ts)
4. Migrate client-side callers (actions/page.tsx, task-list.tsx x2, interaction-modal.tsx)
5. Verify each call site by reading the resulting interactions VIEW row count via Supabase

### Why interactions VIEW Part B preserves type via context.type
The verb `interaction.backfilled` (W3 entry) does not carry the original interaction_type
in its name. Without `COALESCE(ae.context->>'type', REPLACE(ae.verb, 'interaction.', ''))`,
backfilled rows would surface as type='backfilled' which would not match any UI filter.
The COALESCE preserves the original value through context.

### Realtime filter syntax
Supabase JS client v2 supports filter on `postgres_changes`:
```
.on('postgres_changes', { event: '*', schema: 'public', table: 'activity_events',
                          filter: 'verb=like.interaction.%' }, callback)
```
If this filter syntax doesn't work in the deployed client version, fall back to no
filter on the channel + early-return inside the callback if `payload.new.verb` doesn't
start with 'interaction.'.

### tasks page type filter UI
Add a second Select to the existing Active/Completed/All filter:
- Type: All / Todo / Follow-up / Commitment
- Defaults to "All" unless URL query `?type=follow_up` (or `todo`/`commitment`) present
- When type query param present, the Select reflects it; user can change inline
- Bookmark/redirect from `/follow-ups` lands on `/tasks?type=follow_up` and shows
  follow-up-only tasks

### next.config.js redirect
```js
const nextConfig = {
  async redirects() {
    return [{ source: '/follow-ups', destination: '/tasks?type=follow_up', permanent: true }];
  },
};
```
308 (permanent) so browsers cache it; matches the deletion intent.

</specifics>

<deferred>
## Deferred Ideas

- /today component rebuilds (5 deleted spine components: tier-alerts, overdue-commitments,
  today-focus, recent-captures, week-stats) -- spin out as phase 006 build session
- Ticket unification (material_requests stays separate per R2 ruling)
- Migrating `src/lib/captures/promote.ts` `capture.promoted` event from generic to
  per-target verbs (already partially done via capture.promoted.task etc; out of scope here)
- Replace the rule-based capture parser with Claude API tool use (Blocker)
- Voice/mic capture for the Universal Capture Bar (Blocker)
- Inline contact picker for unmatched captures (Blocker)
- Capture editing after submit (Blocker)
- Vercel cron wiring for /api/captures/cleanup-audio (Blocker)
- New Agent Onboarding campaign row creation (Blocker -- Alex manual step)
- Any new UI surfaces, feature work, or copy/design changes

</deferred>

---

*Phase: 005-slice-3-interactions-routes-cleanup*
*Context gathered: 2026-04-24, defaults locked from chat: plumbing-only, linked_interaction_id column, leave material_requests separate, full delete /follow-ups with redirect.*
