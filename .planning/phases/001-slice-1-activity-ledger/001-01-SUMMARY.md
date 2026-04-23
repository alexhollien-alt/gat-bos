---
plan: 001-01
phase: 001-slice-1-activity-ledger
status: complete
wave: 1
completed: 2026-04-22
---

# Wave 1 Summary: Activity Ledger Foundation

## What Was Built

- `supabase/migrations/20260422100000_activity_events.sql` -- Idempotent DDL for `activity_events` table (10 columns, 3 indexes, RLS policy `owner_read_write`)
- `src/lib/activity/types.ts` -- `ActivityVerb` union type (13 verbs) + `ActivityEvent` interface matching DB columns exactly
- `src/lib/activity/writeEvent.ts` -- Fire-and-forget server-side helper using `adminClient`; never throws, logs errors via `logError()`
- `src/lib/activity/queries.ts` -- `getContactTimeline()` and `getRecentActivity()` using browser Supabase client (RLS-scoped)
- `SCHEMA.md` -- Repo-root architecture reference: layer map, entity classification, slice plan, `activity_events` column reference (71 lines)

## Checkpoint Status

Task 0 (migration paste) is a **blocking human-action checkpoint**. Migration SQL written and paste file opened at `~/Desktop/PASTE-INTO-SUPABASE-activity-events.sql`. Alex must paste into Supabase SQL Editor project `rndnxhvibbqqjrzapdxs` and confirm "migration done" before Wave 2 proceeds.

## Self-Check

- [x] `pnpm typecheck` passes
- [x] `ActivityVerb` covers all 13 verbs from spec
- [x] `interaction.backfilled` present in `ActivityVerb`
- [x] `OWNER_USER_ID` env var pattern in `writeEvent.ts`
- [x] `context->>contact_id` OR filter in `getContactTimeline`
- [x] `SCHEMA.md` under 120 lines with `activity_events` and `spine_inbox` (deprecated)
- [x] `writeEvent` uses `adminClient` (server-only)
- [x] `queries.ts` uses `createClient()` (browser client, RLS-enforced)
- [ ] Migration applied in Supabase (awaiting Alex confirmation)

## Key Files Created

```
supabase/migrations/20260422100000_activity_events.sql
src/lib/activity/types.ts
src/lib/activity/writeEvent.ts
src/lib/activity/queries.ts
SCHEMA.md
```

## Commits

- `5b8f8b0` feat(001-01): add activity_events migration DDL
- `dfb755e` feat(001-01): add activity lib module and SCHEMA.md

## Deviations

None. All files match the exact spec from 001-CONTEXT.md.

## Enables

Wave 2 imports `writeEvent` from `src/lib/activity/writeEvent.ts`.
Wave 3 imports `getContactTimeline` from `src/lib/activity/queries.ts`.
Both require the migration to be live in Supabase before runtime behavior can be tested.
