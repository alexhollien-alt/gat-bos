---
phase: 002-slice-2a-spine-drop
plan: 01
type: summary
completed_at: 2026-04-23
---

# Slice 2A Spine Drop -- Execution Summary

## Outcome

Phase complete. All 6 acceptance checks pass. Migration file on disk, ready for manual execution.

## Tasks Completed

### Task 1: Migration file written
- Path: `supabase/migrations/slice-2a-drop-spine.sql`
- Content: DROP TRIGGER first (line 7), then 5 DROP TABLE IF EXISTS CASCADE statements (lines 9-13)
- Status: disk-only, not executed. Alex pastes manually into Supabase SQL Editor.

### Task 2: Spine directories deleted
- Deleted: `src/app/api/spine/` (11 route files across 8 subdirectories)
- Deleted: `src/lib/spine/` (queries.ts, parser.ts, types.ts)

### Task 3: 5 spine-only today components deleted
- Deleted: tier-alerts.tsx, overdue-commitments.tsx, today-focus.tsx, recent-captures.tsx, week-stats.tsx
- 5 BLOCKERS.md entries written (Sections A, B, C, F, G) for Slice 2B rebuild

### Task 4: today/page.tsx cleaned
- Removed: fetchTodayPayload import, supabase createClient, getUser call, prefetchQuery block
- Kept: QueryClient, dehydrate, HydrationBoundary, TodayClient

### Task 5: today-client.tsx cleaned
- Removed: TodayPayloadT import, 5 deleted component imports, spine useQuery block, isLoading guard, payload prop passes, dataUpdatedAt block
- Kept: useQueryClient, Refresh button (now calls invalidateQueries() with no key filter), InboxSummaryCard, DraftsPending, TodayEvents, ProjectsActive, TouchpointsDue

### Task 6: Docs + verification
- task-list.tsx: removed "See spine-worktree fix note" from comment
- SCHEMA.md: 5 spine tables → status `dropped`, last-updated 2026-04-23
- BLOCKERS.md WR-05: moved from Open → Resolved
- BUILD.md: Slice 2A entry added to Built section; migration execution note added to Currently Building

## Verification Gate Results

| Check | Result |
|-------|--------|
| 1. grep -r "from.*@/lib/spine" src/ | 0 hits PASS |
| 2. grep -r '"api/spine' src/ | 0 hits PASS |
| 3. overdue-commitments.tsx deleted | PASS |
| 4. Migration file has trigger drop | PASS (line 7) |
| 5. pnpm typecheck | PASS (zero errors) |
| 6. pnpm build | PASS (zero errors, no spine routes in output) |

## Note on typecheck

The `.next/types/app/api/spine/` stale cache stubs caused `pnpm typecheck` to fail on first run (stubs referenced deleted source files). Running `pnpm build` regenerated `.next/types` from current routes, clearing the stubs. `pnpm typecheck` passed cleanly after.

## What Alex needs to do next

1. Open Supabase SQL Editor
2. Paste contents of `supabase/migrations/slice-2a-drop-spine.sql`
3. Execute -- drops `interactions_update_cycle` trigger + 5 spine tables
4. Verify no errors in SQL Editor output

After that, the codebase and database are fully in sync and Slice 2B can begin.
