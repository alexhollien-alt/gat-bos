# Phase 002: Slice 2A -- Spine Drop - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Source:** Session starter block reviewed and approved by Alex

<domain>
## Phase Boundary

Delete all spine infrastructure from the codebase. Five deprecated Supabase tables (commitments, focus_queue, cycle_state, signals, spine_inbox) and the interactions_update_cycle trigger are dropped via a new migration file. The entire src/app/api/spine/ directory (11 route files) and src/lib/spine/ directory (3 files) are deleted. All UI-layer imports from @/lib/spine/* are removed, the overdue-commitments component is deleted, and any today-page component whose sole data source was the spine payload is also deleted. BLOCKERS.md WR-05 is closed. SCHEMA.md and BUILD.md are updated.

This is a plumbing session: delete-only plus one new migration file. No new UI, no new routes, no new features.

</domain>

<decisions>
## Implementation Decisions

### Migration

- New file: `supabase/migrations/slice-2a-drop-spine.sql`
- DROP TRIGGER IF EXISTS interactions_update_cycle ON public.interactions; MUST precede all table drops (trigger references cycle_state)
- DROP TABLE IF EXISTS: commitments, focus_queue, cycle_state, signals, spine_inbox
- File is written to disk only. Alex executes it manually in Supabase SQL Editor. Claude does NOT run the SQL.

### API Routes

- Delete entire directory: `src/app/api/spine/` (11 route files)
- No replacement routes. Spine API is dead.

### Lib Directory

- Delete entire directory: `src/lib/spine/` (queries.ts, parser.ts, types.ts)
- No replacement lib. All spine logic is obsolete.

### UI Layer Cleanup

- `src/app/(app)/today/page.tsx` -- remove fetchTodayPayload import and the spine prefetch block
- `src/app/(app)/today/today-client.tsx` -- remove TodayPayloadT import, OverdueCommitmentsSection import, the entire ["spine","today"] useQuery block, and all payload.* prop passes
- `src/components/today/overdue-commitments.tsx` -- DELETE (renders commitments table data)
- `src/components/today/week-stats.tsx` -- remove TodayPayloadT import; DELETE if spine-only data source
- `src/components/today/tier-alerts.tsx` -- remove TodayPayloadT import; DELETE if spine-only data source
- `src/components/today/today-focus.tsx` -- remove TodayPayloadT import; DELETE if spine-only data source
- `src/components/today/recent-captures.tsx` -- remove TodayPayloadT import; DELETE (renders spine_inbox data, not the new captures table)
- Any component deleted due to spine-only data source is logged to BLOCKERS.md as a build-session rebuild item

### Post-delete state of /today

After this phase, /today renders only: InboxSummaryCard, DraftsPending, ProjectsActive, TouchpointsDue, TodayEvents. The four spine-only components (week-stats, tier-alerts, today-focus, recent-captures) leave visible gaps until a future build session wires replacements. This is the expected and accepted 2A state.

### Verification gate

All 6 checks must PASS before the phase is declared complete:
1. grep -r "from.*@/lib/spine" src/ -- returns 0 hits
2. grep -r '"api/spine' src/ -- returns 0 hits
3. test -f src/components/today/overdue-commitments.tsx -- returns false (file deleted)
4. grep -q "DROP TRIGGER IF EXISTS interactions_update_cycle" supabase/migrations/slice-2a-drop-spine.sql -- PASS
5. pnpm typecheck -- PASS
6. pnpm build -- PASS

### Documents

- BLOCKERS.md WR-05 (interactions_update_cycle trigger still live) -- move to Resolved after migration file is written
- SCHEMA.md -- update 5 spine rows to status: dropped, update last-updated date
- BUILD.md -- add Slice 2A to Built section, update Currently Building

### Claude's Discretion

- Whether week-stats.tsx, tier-alerts.tsx, today-focus.tsx reference non-spine data alongside spine data (read each file before deciding to delete vs. just remove the import)
- Exact BLOCKERS.md rebuild entries for deleted components (write a descriptive entry for each deleted component)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spine deprecation source of truth
- `SCHEMA.md` -- lists all 5 deprecated tables with "live (deprecated)" status; confirms interactions table stays live
- `BLOCKERS.md` -- WR-05 entry: interactions_update_cycle trigger on public.interactions; defined in supabase/migrations/20260407021000_spine_interactions_trigger.sql

### Migration naming convention
- `supabase/migrations/phase-1.5-calendar.sql` -- example of current naming pattern (no timestamp prefix); new file follows same pattern

### UI files to modify or delete (read before editing)
- `src/app/(app)/today/today-client.tsx` -- spine useQuery block at lines 34-49; payload prop passes at lines 91 and 130
- `src/app/(app)/today/page.tsx` -- fetchTodayPayload import at line 15; spine prefetch at lines 28-29
- `src/components/today/overdue-commitments.tsx` -- DELETE
- `src/components/today/week-stats.tsx` -- read to determine if spine-only before deleting
- `src/components/today/tier-alerts.tsx` -- read to determine if spine-only before deleting
- `src/components/today/today-focus.tsx` -- read to determine if spine-only before deleting
- `src/components/today/recent-captures.tsx` -- DELETE (spine_inbox data source confirmed)

### Out of scope
- `src/lib/activity/` -- do not touch (Slice 1 output, canonical write target)
- `src/lib/captures/` -- do not touch (Session 6 output, new captures system)
- `interactions` table -- do not drop (Slice 2B after soak period)

</canonical_refs>

<specifics>
## Specific Ideas

- The trigger drop line must appear BEFORE the DROP TABLE for cycle_state in the migration, or Supabase will reject it
- The task-list.tsx comment at line 137 references "spine-worktree fix note" -- this is comment-only, not an import; typecheck will not fail from it, but the comment should be cleaned up for hygiene
- pnpm build will be the final arbiter since Next.js catches unused imports and missing modules at build time

</specifics>

<deferred>
## Deferred Ideas

- Rewiring week-stats, tier-alerts, today-focus, recent-captures to non-spine data sources -- Slice 2B build session
- Dropping the interactions table -- Slice 2B after soak period
- Captures consolidation -- Slice 2B
- tasks/opportunities merge -- Slice 2C

</deferred>

---

*Phase: 002-slice-2a-spine-drop*
*Context gathered: 2026-04-23 via session starter block (Alex reviewed and approved scope)*
