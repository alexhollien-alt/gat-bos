---
phase: 003-slice-2b-captures-consolidation
plan: 05
subsystem: database
tags: [supabase, migration, sql, captures, schema]

# Dependency graph
requires:
  - phase: 003-01
    provides: Migration file 20260423120000_slice2b_captures_merge.sql
  - phase: 003-02
    provides: TypeScript types (Capture, SuggestedTarget, PromotedTarget extensions)
  - phase: 003-03
    provides: promote.ts refactor + process route update
  - phase: 003-04
    provides: cleanup-audio cron route
provides:
  - Paste file PASTE-INTO-SUPABASE-slice2b.sql written to ~/Desktop (migration ready for manual execution)
  - pnpm typecheck PASS
  - pnpm build PASS
  - /api/captures/cleanup-audio route confirmed building (0 B, Dynamic)
affects: [003-06, any phase touching captures schema, tasks/events/project_touchpoints writes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "supabase db push --linked fails when schema_migrations table has ordering conflicts; use paste file as fallback"

key-files:
  created:
    - ~/Desktop/PASTE-INTO-SUPABASE-slice2b.sql
  modified: []

key-decisions:
  - "supabase db push --linked: migration ordering conflict (20260407021000 duplicate key in schema_migrations) -- paste file written as fallback per plan instructions"
  - "pnpm typecheck and pnpm build run independently of DB state -- both pass as TS-level gates"

patterns-established:
  - "Pattern: migration paste file to ~/Desktop/PASTE-INTO-<TOOL>.sql when supabase CLI push fails"

requirements-completed: [SLICE-2B-06]

# Metrics
duration: 8min
completed: 2026-04-23
---

# Phase 003 Plan 05: DB Migration Push Summary

**Migration SQL written to ~/Desktop/PASTE-INTO-SUPABASE-slice2b.sql for manual execution; pnpm typecheck PASS, pnpm build PASS**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-23T00:00:00Z
- **Completed:** 2026-04-23
- **Tasks:** 1 (Task 6 -- push migration / write paste file)
- **Files modified:** 0 (paste file written to Desktop, not tracked in git)

## Accomplishments

- Verified migration file `supabase/migrations/20260423120000_slice2b_captures_merge.sql` is complete and correct
- Attempted `supabase db push --linked` -- failed due to schema_migrations ordering conflict (not Docker)
- Wrote full migration SQL to `~/Desktop/PASTE-INTO-SUPABASE-slice2b.sql` and opened it per Standing Rule 20
- pnpm typecheck: **PASS** (tsc --noEmit, exit 0)
- pnpm build: **PASS** (exit 0, all 37 static pages generated, /api/captures/cleanup-audio route confirmed present)

## Task Commits

No new code commits this plan -- all work was DB-push attempt and paste file creation.

Prior plan commits (from 003-01 through 003-04) are the source of the migration and TypeScript changes:
- `d48c1a1` feat(003-03): refactor promote.ts to adminClient + 5 explicit target handlers
- `60485be` feat(003-03): remove supabase param from promoteCapture call in process route
- `22eada8` feat(003-04): add cleanup-audio cron route and captures-audio lifecycle blocker
- `03d1c62` docs(003-04): complete cleanup-audio cron plan summary

## Files Created/Modified

- `~/Desktop/PASTE-INTO-SUPABASE-slice2b.sql` -- Full migration SQL for manual paste into Supabase SQL Editor
  (copy of `supabase/migrations/20260423120000_slice2b_captures_merge.sql`)

## Decisions Made

- Used paste file fallback: `supabase db push --linked` and `--include-all` both failed with a
  `duplicate key value violates unique constraint "schema_migrations_pkey"` error on migration
  `20260407021000`. The remote schema_migrations table already has that version; the CLI tried to
  INSERT it again. This is a known supabase CLI state-sync issue, not a Docker issue.
- Per plan instructions: write migration SQL to ~/Desktop/PASTE-INTO-SUPABASE-slice2b.sql and stop.
  DB verification queries (column counts, table existence checks) are deferred until after Alex pastes.

## Deviations from Plan

None -- plan explicitly covered the Docker/paste fallback path. The actual failure mode (schema_migrations
duplicate key rather than Docker not running) differs in cause but not in handling: write paste file, stop.
Plan outcome is identical.

## Issues Encountered

- `supabase db push --linked` error: "Found local migration files to be inserted before the last migration on remote database." Reran with `--include-all`. Second attempt failed: `ERROR: duplicate key value violates unique constraint "schema_migrations_pkey"` on `20260407021000_spine_interactions_trigger.sql`. The remote already has this migration recorded; the CLI cannot safely insert it. Root cause: local supabase/migrations/ includes pre-existing timestamped migrations that are already applied on remote but recorded under a different tracking mechanism.
- Resolution: paste file path per plan.

## User Setup Required

**Alex must paste the migration manually into Supabase SQL Editor.**

Steps:
1. Open Supabase Dashboard > SQL Editor > New Query
2. Paste the contents of `~/Desktop/PASTE-INTO-SUPABASE-slice2b.sql`
3. Click Run
4. Verify with these queries:
   ```sql
   -- Should return 0 rows (tables dropped)
   SELECT tablename FROM pg_tables
   WHERE schemaname='public'
   AND tablename IN ('voice_memos','intake_queue','email_inbox');

   -- Should return 5 rows (new columns)
   SELECT column_name FROM information_schema.columns
   WHERE table_name='captures'
   AND column_name IN ('source','suggested_target','transcript','metadata','status')
   ORDER BY column_name;
   ```
5. Type "approved" to continue to Plan 06.

## Next Phase Readiness

- Paste file is ready: `~/Desktop/PASTE-INTO-SUPABASE-slice2b.sql`
- pnpm typecheck + build both pass -- codebase is clean
- Plan 06 (git commit, BUILD.md update, tag, PR) can proceed after Alex confirms paste executed
- DB verification queries from plan Task 6 Step 2 are blocked until paste is confirmed

## Self-Check

- [x] PASTE-INTO-SUPABASE-slice2b.sql exists on Desktop
- [x] pnpm typecheck exit 0
- [x] pnpm build exit 0
- [x] SUMMARY.md created at correct path

## Self-Check: PASSED

---
*Phase: 003-slice-2b-captures-consolidation*
*Completed: 2026-04-23*
