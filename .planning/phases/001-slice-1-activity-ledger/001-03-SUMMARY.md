---
phase: 001-slice-1-activity-ledger
plan: "03"
subsystem: database
tags: [activity-ledger, contact-timeline, backfill, spine-deprecation, typescript]

# Dependency graph
requires:
  - phase: 001-slice-1-activity-ledger
    plan: "01"
    provides: writeEvent helper + activity_events DDL + getContactTimeline query
  - phase: 001-slice-1-activity-ledger
    plan: "02"
    provides: five write paths emitting activity events with contact_id

provides:
  - Contact detail page Activity Feed reads from getContactTimeline (ledger-first, buildActivityFeed fallback)
  - Idempotent backfill script seeds activity_events from last 7 days of interactions
  - Deprecation comments on all 3 spine TypeScript files and all 3 spine migration SQL files
  - CLAUDE.md Architecture Notes section declaring activity_events as canonical and spine as deprecated

affects:
  - slice-2 (spine table DROP is now safe -- deprecated + backed by ledger)
  - future-contact-views (timeline reads from activity_events going forward)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ledger-first with graceful fallback: ledgerTimeline.length === 0 falls back to buildActivityFeed so contacts with no ledger rows still show history"
    - "DB-to-display mapping inline: verb -> sourceLabel/iconName/barColorClass map inside useMemo, no new component"
    - "Backfill idempotency: maybeSingle() check per row before insert, skips if interaction.backfilled event already exists for that object_id"
    - "Backfill env pattern: readFileSync .env.local, no dotenv, no @/ aliases, plain .mjs"

key-files:
  created:
    - scripts/backfill-activity-events.mjs
  modified:
    - src/app/(app)/contacts/[id]/page.tsx
    - src/lib/spine/parser.ts
    - src/lib/spine/queries.ts
    - src/lib/spine/types.ts
    - supabase/migrations/20260407020000_spine_tables.sql
    - supabase/migrations/20260407021000_spine_interactions_trigger.sql
    - supabase/migrations/20260408001000_cleanup_spine_smoke_test_data.sql
    - CLAUDE.md

key-decisions:
  - "Fallback to buildActivityFeed when ledgerTimeline is empty -- ensures contacts with no backfilled rows show history on day one rather than a blank feed"
  - "Verb-to-display mapping kept inline in useMemo -- adding a helper would be premature abstraction for 6 verb strings"
  - "interactions table has no deleted_at column -- filter removed from backfill script (fix commit 2e48850)"
  - "Deprecation comments prepended to all 6 spine files rather than removing code -- safe path; Drop waits for Slice 2"

patterns-established:
  - "Ledger-first with fallback: check ledger length, fall back to legacy builder when empty"
  - "Backfill script pattern: .mjs, readFileSync, adminClient, maybeSingle idempotency guard"

requirements-completed: [SLICE-1-T8, SLICE-1-T9, SLICE-1-T10, SLICE-1-T11]

# Metrics
duration: ~25min
completed: 2026-04-22
---

# Phase 001 Plan 03: Wave 3 -- Contact Timeline Wiring + Backfill Summary

**Contact detail Activity Feed now reads from the activity_events ledger (falling back to buildActivityFeed for contacts not yet backfilled), seeded via an idempotent backfill script, with all six spine files marked deprecated.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-22
- **Completed:** 2026-04-22
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 9 (1 created, 8 modified)

## Accomplishments

- Contact detail page `activityEvents` useMemo now calls `getContactTimeline(contactId)` first; falls back to `buildActivityFeed` only when the ledger returns zero rows for that contact
- DB `ActivityEvent` rows mapped inline to the display `ActivityEvent` shape using a verb lookup table -- no new component
- Idempotent backfill script `scripts/backfill-activity-events.mjs` written as plain `.mjs`, reads `.env.local` via `readFileSync`, checks for existing `interaction.backfilled` rows before each insert (ran Inserted:2 / Skipped:2 on second run, confirming idempotency)
- Deprecation comments prepended to all 3 spine TypeScript files and all 3 spine migration SQL files
- `CLAUDE.md` Architecture Notes section added declaring `activity_events` as canonical write target and spine as deprecated
- `pnpm typecheck` and `pnpm build` pass

## Task Commits

1. **Task 1: Wire contact Activity Feed to getContactTimeline** - `fa3e1da` (feat)
2. **Task 2: Write backfill script, deprecate spine files, update CLAUDE.md** - `a91520a` (feat)
3. **Task 2 fix: Remove deleted_at filter from backfill** - `2e48850` (fix)
4. **Task 3: Human verify checkpoint** -- confirmed by Alex ("verified")

## Files Created/Modified

- `src/app/(app)/contacts/[id]/page.tsx` -- Added `ledgerTimeline` state + `fetchLedgerTimeline` callback; replaced `activityEvents` useMemo with ledger-first/fallback version using verb-to-display map
- `scripts/backfill-activity-events.mjs` -- New: one-time idempotent backfill from `interactions` -> `activity_events` with `interaction.backfilled` verb
- `src/lib/spine/parser.ts` -- Deprecation comment prepended
- `src/lib/spine/queries.ts` -- Deprecation comment prepended
- `src/lib/spine/types.ts` -- Deprecation comment prepended
- `supabase/migrations/20260407020000_spine_tables.sql` -- SQL deprecation comment prepended
- `supabase/migrations/20260407021000_spine_interactions_trigger.sql` -- SQL deprecation comment prepended
- `supabase/migrations/20260408001000_cleanup_spine_smoke_test_data.sql` -- SQL deprecation comment prepended
- `CLAUDE.md` (crm) -- Architecture Notes section inserted between GSD Protocol and Build vs Plumbing Protocol

## Decisions Made

- Fallback to `buildActivityFeed` when `ledgerTimeline.length === 0` so contacts with no backfilled rows still display their history from the legacy five-table union rather than showing a blank feed
- Verb-to-display mapping kept inline in `useMemo` (6 verb strings) -- extracting to a helper file would be premature abstraction
- `interactions` table has no `deleted_at` column -- the initial backfill draft included `.is('deleted_at', null)` which would have caused a Supabase error; removed in fix commit `2e48850`
- Spine files marked deprecated with comments rather than deleted -- safe incremental approach; actual DROP deferred to Slice 2

## Deviations from Plan

### Auto-fixed Issues

**1. [Runtime error] deleted_at filter on interactions table**
- **Found during:** Task 3 human-verify (backfill script run)
- **Issue:** Backfill script included `.is('deleted_at', null)` filter; `interactions` table has no `deleted_at` column, causing a Supabase query error
- **Fix:** Removed the `.is('deleted_at', null)` line from the `adminClient.from('interactions').select(...)` chain
- **Files modified:** `scripts/backfill-activity-events.mjs`
- **Verification:** Backfill re-run returned "Inserted:2, Skipped:2" confirming both insert and idempotency paths work
- **Committed in:** `2e48850` (fix commit)

---

**Total deviations:** 1 auto-fixed (runtime query error on missing column)
**Impact on plan:** Necessary correction; no scope change.

## Issues Encountered

The `interactions` table does not have a `deleted_at` column (unlike most other tables in the schema). The backfill script initially filtered on it, causing the Supabase SDK to return an error. Removed the filter and re-ran -- both the insert path (2 new rows) and the skip path (2 already-existing rows) confirmed correct behavior.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

**Slice 1 is complete.** All four waves shipped:
- Wave 1: `activity_events` DDL + `writeEvent` helper + `getContactTimeline` query
- Wave 2: Five write paths retrofitted to emit events
- Wave 3: Contact timeline wired to ledger, backfill script, spine deprecated

**Slice 2 readiness:**
- Spine tables (`spine_inbox`, `commitments`, `signals`, `focus_queue`, `cycle_state`) are deprecated and can be safely DROPped in Slice 2
- All 5 write paths are instrumented; contact-level filtering on `activity_events` is live
- The backfill script can be re-run safely at any time (idempotent) to catch interactions added since first run

---
*Phase: 001-slice-1-activity-ledger*
*Completed: 2026-04-22*
