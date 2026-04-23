---
phase: 002-slice-2a-spine-drop
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/slice-2a-drop-spine.sql
  - src/app/(app)/today/page.tsx
  - src/app/(app)/today/today-client.tsx
  - src/components/today/overdue-commitments.tsx
  - src/components/today/week-stats.tsx
  - src/components/today/tier-alerts.tsx
  - src/components/today/today-focus.tsx
  - src/components/today/recent-captures.tsx
  - src/app/api/spine/
  - src/lib/spine/
  - src/components/dashboard/task-list.tsx
  - SCHEMA.md
  - BLOCKERS.md
  - BUILD.md
autonomous: true
requirements:
  - 002-spine-drop

must_haves:
  truths:
    - "No file in src/ imports from @/lib/spine"
    - "No file in src/ references /api/spine"
    - "The overdue-commitments component does not exist on disk"
    - "The migration file exists on disk with the trigger drop preceding all table drops"
    - "pnpm typecheck passes with zero errors"
    - "pnpm build passes with zero errors"
    - "SCHEMA.md shows all 5 spine tables with status: dropped"
    - "BLOCKERS.md WR-05 is in the Resolved section"
  artifacts:
    - path: "supabase/migrations/slice-2a-drop-spine.sql"
      provides: "DROP TRIGGER + DROP TABLE statements for manual execution by Alex"
      contains: "DROP TRIGGER IF EXISTS interactions_update_cycle"
    - path: "src/app/(app)/today/today-client.tsx"
      provides: "Cleaned today view rendering only InboxSummaryCard, DraftsPending, ProjectsActive, TouchpointsDue, TodayEvents"
  key_links:
    - from: "src/app/(app)/today/page.tsx"
      to: "src/lib/spine/queries.ts"
      via: "fetchTodayPayload import -- must be removed"
      pattern: "fetchTodayPayload"
    - from: "src/app/(app)/today/today-client.tsx"
      to: "@/lib/spine/types"
      via: "TodayPayloadT import -- must be removed"
      pattern: "TodayPayloadT"
---

<objective>
Remove all spine infrastructure from the codebase.

Purpose: The five spine tables (commitments, focus_queue, cycle_state, signals, spine_inbox) and the interactions_update_cycle trigger are superseded by activity_events (Slice 1). Their continued presence in the codebase wastes context, trips build errors when they are eventually dropped from Supabase, and keeps dead API routes alive. This phase clears the slate so Slice 2B can begin on a clean foundation.

Output:
- supabase/migrations/slice-2a-drop-spine.sql (written to disk, not executed)
- src/app/api/spine/ directory deleted (11 route files)
- src/lib/spine/ directory deleted (queries.ts, parser.ts, types.ts)
- 5 today-page components deleted (overdue-commitments, week-stats, tier-alerts, today-focus, recent-captures)
- today/page.tsx and today/today-client.tsx cleaned of all spine references
- task-list.tsx comment cleaned
- SCHEMA.md updated, BLOCKERS.md WR-05 resolved, BUILD.md updated
</objective>

<execution_context>
@/Users/alex/crm/.claude/get-shit-done/workflows/execute-plan.md
@/Users/alex/crm/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/alex/crm/.planning/PROJECT.md
@/Users/alex/crm/.planning/ROADMAP.md
@/Users/alex/crm/.planning/STATE.md
@/Users/alex/crm/SCHEMA.md
@/Users/alex/crm/BLOCKERS.md
@/Users/alex/crm/BUILD.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write migration file (disk only -- do NOT execute)</name>
  <files>supabase/migrations/slice-2a-drop-spine.sql</files>

  <read_first>
    - /Users/alex/crm/supabase/migrations/phase-1.5-calendar.sql (naming convention reference)
    - /Users/alex/crm/BLOCKERS.md (WR-05 trigger name and source migration)
    - /Users/alex/crm/SCHEMA.md (confirm the 5 table names exactly)
  </read_first>

  <action>
Create the file at the exact path: /Users/alex/crm/supabase/migrations/slice-2a-drop-spine.sql

Write the following content exactly. The trigger drop line MUST come first -- it references cycle_state, so if the table drops first Supabase will reject the trigger drop:

```sql
-- Slice 2A: Drop spine tables and the trigger that writes into cycle_state.
-- Execute manually in Supabase SQL Editor. Claude does NOT run this.
--
-- Trigger must be dropped before cycle_state is dropped.
-- All 5 tables use IF EXISTS so the statement is idempotent.

DROP TRIGGER IF EXISTS interactions_update_cycle ON public.interactions;

DROP TABLE IF EXISTS public.commitments CASCADE;
DROP TABLE IF EXISTS public.focus_queue CASCADE;
DROP TABLE IF EXISTS public.cycle_state CASCADE;
DROP TABLE IF EXISTS public.signals CASCADE;
DROP TABLE IF EXISTS public.spine_inbox CASCADE;
```

Do NOT run this SQL. Do NOT paste it into Supabase. Write the file to disk and stop. Alex executes it manually.
  </action>

  <verify>
    <automated>grep -q "DROP TRIGGER IF EXISTS interactions_update_cycle" /Users/alex/crm/supabase/migrations/slice-2a-drop-spine.sql && grep -q "DROP TABLE IF EXISTS public.commitments CASCADE" /Users/alex/crm/supabase/migrations/slice-2a-drop-spine.sql && echo "PASS: migration file exists with required content"</automated>
  </verify>

  <acceptance_criteria>
    - File exists at /Users/alex/crm/supabase/migrations/slice-2a-drop-spine.sql
    - grep -q "DROP TRIGGER IF EXISTS interactions_update_cycle" returns exit 0
    - The trigger drop line appears before any DROP TABLE line in the file (verify line order)
    - File contains DROP TABLE lines for all 5: commitments, focus_queue, cycle_state, signals, spine_inbox
    - File has NOT been executed (Alex confirms manually)
  </acceptance_criteria>

  <done>Migration file on disk, correct content, trigger-before-table ordering confirmed.</done>
</task>

<task type="auto">
  <name>Task 2: Delete src/app/api/spine/ and src/lib/spine/ directories</name>
  <files>
    src/app/api/spine/capture/route.ts,
    src/app/api/spine/commitments/route.ts,
    src/app/api/spine/commitments/[id]/route.ts,
    src/app/api/spine/cycle/[contactId]/route.ts,
    src/app/api/spine/focus/route.ts,
    src/app/api/spine/focus/[id]/route.ts,
    src/app/api/spine/inbox/route.ts,
    src/app/api/spine/parse/[inboxId]/route.ts,
    src/app/api/spine/signals/route.ts,
    src/app/api/spine/signals/[id]/route.ts,
    src/app/api/spine/today/route.ts,
    src/lib/spine/queries.ts,
    src/lib/spine/parser.ts,
    src/lib/spine/types.ts
  </files>

  <read_first>
    - /Users/alex/crm/src/app/api/spine/today/route.ts (confirm it only imports from @/lib/spine, not from any live lib)
    - /Users/alex/crm/src/lib/spine/queries.ts (confirm no exports used outside spine/ and today/)
    - /Users/alex/crm/src/lib/spine/types.ts (confirm no exports used outside spine/ and today/)
  </read_first>

  <action>
Delete the following directories in full using rm -rf:
  - /Users/alex/crm/src/app/api/spine/
  - /Users/alex/crm/src/lib/spine/

These 14 files are all dead code. The spine API routes only import from @/lib/spine/* which is also being deleted. No live code outside these two directories imports from src/app/api/spine/ (confirmed by grep in planning: grep -r '"api/spine' src/ returned 0 hits in non-spine files).

Use these exact Bash commands:
  rm -rf /Users/alex/crm/src/app/api/spine
  rm -rf /Users/alex/crm/src/lib/spine
  </action>

  <verify>
    <automated>test ! -d /Users/alex/crm/src/app/api/spine && test ! -d /Users/alex/crm/src/lib/spine && echo "PASS: both spine directories removed"</automated>
  </verify>

  <acceptance_criteria>
    - test ! -d /Users/alex/crm/src/app/api/spine returns exit 0 (directory does not exist)
    - test ! -d /Users/alex/crm/src/lib/spine returns exit 0 (directory does not exist)
    - No subdirectories or files remain under either path
  </acceptance_criteria>

  <done>Both spine directories deleted from disk. 14 files gone.</done>
</task>

<task type="auto">
  <name>Task 3: Delete 5 spine-only today-page components</name>
  <files>
    src/components/today/overdue-commitments.tsx,
    src/components/today/week-stats.tsx,
    src/components/today/tier-alerts.tsx,
    src/components/today/today-focus.tsx,
    src/components/today/recent-captures.tsx
  </files>

  <read_first>
    - /Users/alex/crm/src/components/today/overdue-commitments.tsx (confirmed spine-only: imports from @/lib/spine/types)
    - /Users/alex/crm/src/components/today/week-stats.tsx (confirmed spine-only: all data from TodayPayloadT["week_rotation_summary"])
    - /Users/alex/crm/src/components/today/tier-alerts.tsx (confirmed spine-only: all data from TodayPayloadT["coming_due"])
    - /Users/alex/crm/src/components/today/today-focus.tsx (confirmed spine-only: all data from TodayPayloadT["today_focus"])
    - /Users/alex/crm/src/components/today/recent-captures.tsx (confirmed spine-only: all data from TodayPayloadT["recent_captures"] -- different from the new captures table)
  </read_first>

  <action>
Delete all 5 files. These components have no non-spine data source and are obsolete.

Use these exact Bash commands:
  rm /Users/alex/crm/src/components/today/overdue-commitments.tsx
  rm /Users/alex/crm/src/components/today/week-stats.tsx
  rm /Users/alex/crm/src/components/today/tier-alerts.tsx
  rm /Users/alex/crm/src/components/today/today-focus.tsx
  rm /Users/alex/crm/src/components/today/recent-captures.tsx

Then add 5 entries to BLOCKERS.md under ## Open, each with today's date, describing that the component was deleted as spine-only and needs rewiring to activity_events data in Slice 2B:

Entry template for each:
### [2026-04-23] {ComponentName} deleted -- needs Slice 2B rebuild
- **Broken:** `src/components/today/{filename}.tsx` deleted in Slice 2A (spine-only data source). Visible gap on /today until replaced.
- **Where:** Was rendered in `src/app/(app)/today/today-client.tsx`. Section {letter} in the original layout.
- **Fix needed:** Slice 2B build session: rewrite component reading from activity_events (or contacts/interactions) instead of the deprecated spine payload. Wire replacement back into today-client.tsx.

Add entries for: tier-alerts.tsx (Section A), overdue-commitments.tsx (Section B), today-focus.tsx (Section C), recent-captures.tsx (Section F), week-stats.tsx (Section G).
  </action>

  <verify>
    <automated>test ! -f /Users/alex/crm/src/components/today/overdue-commitments.tsx && test ! -f /Users/alex/crm/src/components/today/week-stats.tsx && test ! -f /Users/alex/crm/src/components/today/tier-alerts.tsx && test ! -f /Users/alex/crm/src/components/today/today-focus.tsx && test ! -f /Users/alex/crm/src/components/today/recent-captures.tsx && echo "PASS: all 5 spine-only components deleted"</automated>
  </verify>

  <acceptance_criteria>
    - test ! -f for each of the 5 files returns exit 0
    - BLOCKERS.md contains 5 new entries under ## Open dated 2026-04-23 for each deleted component
    - No other files in src/components/today/ are touched
  </acceptance_criteria>

  <done>5 spine-only components deleted. BLOCKERS.md entries written for each.</done>
</task>

<task type="auto">
  <name>Task 4: Clean today/page.tsx -- remove spine prefetch</name>
  <files>src/app/(app)/today/page.tsx</files>

  <read_first>
    - /Users/alex/crm/src/app/(app)/today/page.tsx (full file -- read before editing)
  </read_first>

  <action>
Edit /Users/alex/crm/src/app/(app)/today/page.tsx to remove all spine references.

Current file (39 lines) has:
  - Line 15: `import { fetchTodayPayload } from "@/lib/spine/queries";`
  - Lines 27-30: the spine prefetch block inside the `if (user)` branch:
    ```
    await queryClient.prefetchQuery({
      queryKey: ["spine", "today"],
      queryFn: () => fetchTodayPayload(supabase, user.id),
    });
    ```

After the edit, the file should:
  1. Have the `import { fetchTodayPayload }` line removed entirely
  2. Have the entire `if (user) { await queryClient.prefetchQuery(...) }` block removed
  3. Keep all other imports (QueryClient, dehydrate, HydrationBoundary, createClient, TodayClient)
  4. Keep the supabase client creation and getUser call IF there are other uses of `user` or `supabase` -- but since the only use of `user` was the spine prefetch, and the only use of `supabase` was in that same block, both the supabase createClient line and the getUser block can also be removed
  5. The final function body should just be:
    ```typescript
    export default async function TodayPage() {
      const queryClient = new QueryClient();

      return (
        <HydrationBoundary state={dehydrate(queryClient)}>
          <TodayClient />
        </HydrationBoundary>
      );
    }
    ```

Remove the `"use server"` or server-component comment header only if it references the spine payload. The doc comment at the top references "spine TodayPayload" -- update it to just say "Today View server shell" or remove the comment block.
  </action>

  <verify>
    <automated>grep -q "fetchTodayPayload" /Users/alex/crm/src/app/(app)/today/page.tsx && echo "FAIL: fetchTodayPayload still present" || echo "PASS: fetchTodayPayload removed"</automated>
  </verify>

  <acceptance_criteria>
    - grep -q "fetchTodayPayload" returns exit 1 (not found)
    - grep -q "spine" returns exit 1 (no spine references in file)
    - grep -q "from.*@/lib/spine" returns exit 1 (no spine imports)
    - File still compiles (no missing imports used elsewhere in the file)
    - HydrationBoundary and TodayClient still present in the JSX return
  </acceptance_criteria>

  <done>today/page.tsx has zero spine references. Server-side prefetch block removed.</done>
</task>

<task type="auto">
  <name>Task 5: Clean today/today-client.tsx -- remove spine useQuery block and all payload references</name>
  <files>src/app/(app)/today/today-client.tsx</files>

  <read_first>
    - /Users/alex/crm/src/app/(app)/today/today-client.tsx (full file -- read before editing)
  </read_first>

  <action>
Edit /Users/alex/crm/src/app/(app)/today/today-client.tsx to remove all spine references and all deleted component references.

Specific changes required (reference line numbers from the current file read during planning):

1. Remove import on line 16: `import type { TodayPayloadT } from "@/lib/spine/types";`

2. Remove 5 import lines for deleted components (lines 18-22):
   - `import { TierAlertsSection } from "@/components/today/tier-alerts";`
   - `import { OverdueCommitmentsSection } from "@/components/today/overdue-commitments";`
   - `import { TodayFocusSection } from "@/components/today/today-focus";`
   - `import { RecentCapturesSection } from "@/components/today/recent-captures";`
   - `import { WeekStatsSection } from "@/components/today/week-stats";`

3. Remove the spine useQuery block (lines 34-46):
   ```
   const { data, isLoading, dataUpdatedAt } = useQuery<TodayPayloadT>({
     queryKey: ["spine", "today"],
     queryFn: async () => {
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) throw new Error("Not authenticated");
       const res = await fetch("/api/spine/today");
       if (!res.ok) throw new Error("Failed to fetch today payload");
       return res.json();
     },
     staleTime: 30 * 1000,
   });
   ```

4. Remove `const payload = data ?? null;` (line 52) and the `isLoading` check that wraps the entire content block.

5. Remove all payload prop passes in JSX:
   - `<TierAlertsSection comingDue={payload.coming_due} />` (line 87)
   - `<OverdueCommitmentsSection commitments={payload.overdue_commitments} />` (lines 90-92)
   - `<TodayFocusSection focusItems={payload.today_focus} weekSummary={payload.week_rotation_summary} />` (lines 95-98)
   - `<RecentCapturesSection captures={payload.recent_captures} />` (line 125)
   - `<WeekStatsSection weekSummary={payload.week_rotation_summary} signalCount={payload.high_signals.length} />` (lines 128-131)

6. Remove the isLoading guard conditional (the outer ternary wrapping the content `<div className="space-y-6">`). The new render should unconditionally render the content div.

7. Remove `const { data, isLoading, dataUpdatedAt }` destructure. Also remove `useQueryClient` and the `handleRefresh` function IF the Refresh button is the only consumer of `queryClient` -- check if queryClient is used elsewhere. If the Refresh button is keeping useQueryClient, keep both. Otherwise remove both.

8. The `dataUpdatedAt > 0` block at the bottom (line 136-139) references `dataUpdatedAt` from the deleted useQuery -- remove it.

After the edit, the today-client.tsx render should contain only:
- Section D (Inbox) with InboxSummaryCard
- DraftsPending (Section D.1)
- TodayEvents (Section E)
- ProjectsActive (Section E.1)
- TouchpointsDue (Section E.2)

Keep the PageHeader, AccentRule, SectionShell, the date display, and the Refresh button (the Refresh button can still call queryClient.invalidateQueries on the non-spine queries if desired, or simply be removed if no live queries remain to refresh -- use judgment).

Keep all imports that are still in use after the above removals: useQuery (if any remaining query), createClient, format, InboxSummaryCard, DraftsPending, ProjectsActive, TouchpointsDue, Inbox, RefreshCw, AccentRule, PageHeader, SectionShell, TodayEvents.
  </action>

  <verify>
    <automated>grep -q "from.*@/lib/spine" /Users/alex/crm/src/app/(app)/today/today-client.tsx && echo "FAIL: spine import still present" || echo "PASS: no spine imports"; grep -q "TierAlertsSection\|OverdueCommitmentsSection\|TodayFocusSection\|RecentCapturesSection\|WeekStatsSection" /Users/alex/crm/src/app/(app)/today/today-client.tsx && echo "FAIL: deleted component reference still present" || echo "PASS: no deleted component references"</automated>
  </verify>

  <acceptance_criteria>
    - grep -q "from.*@/lib/spine" returns exit 1 (no spine imports)
    - grep -q "TodayPayloadT" returns exit 1 (type import gone)
    - grep -q "TierAlertsSection" returns exit 1
    - grep -q "OverdueCommitmentsSection" returns exit 1
    - grep -q "TodayFocusSection" returns exit 1
    - grep -q "RecentCapturesSection" returns exit 1
    - grep -q "WeekStatsSection" returns exit 1
    - grep -q "api/spine/today" returns exit 1 (fetch call gone)
    - grep -q "payload\." returns exit 1 (no payload prop passes)
    - InboxSummaryCard still imported and rendered
    - DraftsPending still imported and rendered
    - TodayEvents still imported and rendered
  </acceptance_criteria>

  <done>today-client.tsx renders only the 5 surviving sections. Zero spine references remain.</done>
</task>

<task type="auto">
  <name>Task 6: Clean task-list.tsx comment and run verification gate</name>
  <files>
    src/components/dashboard/task-list.tsx,
    SCHEMA.md,
    BLOCKERS.md,
    BUILD.md
  </files>

  <read_first>
    - /Users/alex/crm/src/components/dashboard/task-list.tsx (read lines 130-145 to see the comment context)
    - /Users/alex/crm/SCHEMA.md (to update the 5 spine table rows)
    - /Users/alex/crm/BLOCKERS.md (to move WR-05 to Resolved)
    - /Users/alex/crm/BUILD.md (to update Currently Building and add to Built)
  </read_first>

  <action>
**Step 1: Clean task-list.tsx comment**

In /Users/alex/crm/src/components/dashboard/task-list.tsx at line 137, remove or reword the comment `// contacts in two queries, then join in memory. See spine-worktree fix note.`

Replace it with a neutral comment like: `// contacts in two queries, then join in memory.` -- removing the "See spine-worktree fix note" reference since the spine worktree no longer exists.

**Step 2: Update SCHEMA.md**

In /Users/alex/crm/SCHEMA.md, update the 5 deprecated spine table rows in the Entity Classification table. Change status from `live (deprecated)` to `dropped` and update Notes to `Dropped in Slice 2A migration (slice-2a-drop-spine.sql). Execute migration to finalize.`:

Change these 5 rows:
| spine_inbox | Raw | live (deprecated) | Do not extend. Superseded by activity_events. Will be dropped in Slice 2. |
| commitments | Raw | live (deprecated) | Do not extend. Superseded by activity_events. Will be dropped in Slice 2. |
| signals | Raw | live (deprecated) | Do not extend. Superseded by activity_events. Will be dropped in Slice 2. |
| focus_queue | Raw | live (deprecated) | Do not extend. Superseded by activity_events. Will be dropped in Slice 2. |
| cycle_state | Raw | live (deprecated) | Do not extend. Superseded by activity_events. Will be dropped in Slice 2. |

To:
| spine_inbox | Raw | dropped | Dropped in Slice 2A. Execute supabase/migrations/slice-2a-drop-spine.sql to finalize. |
| commitments | Raw | dropped | Dropped in Slice 2A. Execute supabase/migrations/slice-2a-drop-spine.sql to finalize. |
| signals | Raw | dropped | Dropped in Slice 2A. Execute supabase/migrations/slice-2a-drop-spine.sql to finalize. |
| focus_queue | Raw | dropped | Dropped in Slice 2A. Execute supabase/migrations/slice-2a-drop-spine.sql to finalize. |
| cycle_state | Raw | dropped | Dropped in Slice 2A. Execute supabase/migrations/slice-2a-drop-spine.sql to finalize. |

Also update the `*Last updated:` header line to `*Last updated: 2026-04-23 (Slice 2A)*`.

**Step 3: Resolve WR-05 in BLOCKERS.md**

Move the `### [2026-04-22] interactions_update_cycle trigger still live -- spine DROP blocked on Slice 2B` entry from `## Open` to `## Resolved`.

Add a resolution note:
### [2026-04-22] interactions_update_cycle trigger still live -- RESOLVED 2026-04-23
- Migration file written at `supabase/migrations/slice-2a-drop-spine.sql`. DROP TRIGGER IF EXISTS interactions_update_cycle ON public.interactions; appears as first statement before all DROP TABLE calls. Alex executes manually.

**Step 4: Update BUILD.md**

In BUILD.md:
- Add a `## Built` entry dated 2026-04-23 describing Slice 2A spine drop
- Update `## Currently Building` to reflect next recommended session (keep the universal agent welcome email recommendation as-is, or add a note that Slice 2A plumbing is complete and migration needs manual execution by Alex)

**Step 5: Run verification gate**

Run all 6 checks from the CONTEXT.md verification gate:

```bash
# Check 1: no spine imports
grep -r "from.*@/lib/spine" /Users/alex/crm/src/

# Check 2: no api/spine references  
grep -r '"api/spine' /Users/alex/crm/src/

# Check 3: overdue-commitments deleted
test -f /Users/alex/crm/src/components/today/overdue-commitments.tsx && echo "FAIL: file still exists" || echo "PASS: file deleted"

# Check 4: migration file has trigger drop
grep -q "DROP TRIGGER IF EXISTS interactions_update_cycle" /Users/alex/crm/supabase/migrations/slice-2a-drop-spine.sql && echo "PASS" || echo "FAIL"

# Check 5: typecheck
cd /Users/alex/crm && pnpm typecheck

# Check 6: build
cd /Users/alex/crm && pnpm build
```

All 6 checks must return PASS / zero exit code before the phase is declared complete. If typecheck or build fails, fix the errors before declaring done.
  </action>

  <verify>
    <automated>cd /Users/alex/crm && grep -r "from.*@/lib/spine" src/ | wc -l | xargs -I{} test {} -eq 0 && echo "CHECK 1 PASS" || echo "CHECK 1 FAIL"; grep -r '"api/spine' src/ | wc -l | xargs -I{} test {} -eq 0 && echo "CHECK 2 PASS" || echo "CHECK 2 FAIL"; test ! -f src/components/today/overdue-commitments.tsx && echo "CHECK 3 PASS" || echo "CHECK 3 FAIL"; grep -q "DROP TRIGGER IF EXISTS interactions_update_cycle" supabase/migrations/slice-2a-drop-spine.sql && echo "CHECK 4 PASS" || echo "CHECK 4 FAIL"; pnpm typecheck && echo "CHECK 5 PASS" || echo "CHECK 5 FAIL"; pnpm build && echo "CHECK 6 PASS" || echo "CHECK 6 FAIL"</automated>
  </verify>

  <acceptance_criteria>
    - CHECK 1: grep -r "from.*@/lib/spine" src/ returns 0 hits
    - CHECK 2: grep -r '"api/spine' src/ returns 0 hits
    - CHECK 3: test ! -f src/components/today/overdue-commitments.tsx returns exit 0
    - CHECK 4: grep -q "DROP TRIGGER IF EXISTS interactions_update_cycle" migration file returns exit 0
    - CHECK 5: pnpm typecheck exits 0 with zero errors
    - CHECK 6: pnpm build exits 0 with zero errors
    - SCHEMA.md last-updated line reads "2026-04-23 (Slice 2A)"
    - SCHEMA.md contains "dropped" status for all 5 spine tables (grep -c "dropped" returns 5 from the Entity Classification table)
    - BLOCKERS.md WR-05 entry appears under ## Resolved (not ## Open)
    - BUILD.md contains a 2026-04-23 Built entry for Slice 2A
  </acceptance_criteria>

  <done>All 6 verification checks pass. SCHEMA.md, BLOCKERS.md, BUILD.md updated. Phase 002 complete.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Migration file -- disk to Supabase | File written by Claude, executed by Alex. No automated execution path. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-002-01 | Tampering | slice-2a-drop-spine.sql | accept | File is written to disk only. Alex reviews before executing. DROP IF EXISTS ensures idempotency. |
| T-002-02 | Denial of Service | DROP TABLE CASCADE | mitigate | CASCADE included on all drops. Alex should verify no live foreign keys reference spine tables before executing (interactions_update_cycle trigger is the only known FK-adjacent dependency, handled by the trigger drop first). |
</threat_model>

<verification>
Six checks from CONTEXT.md -- all must PASS:

1. `grep -r "from.*@/lib/spine" src/` -- returns 0 hits
2. `grep -r '"api/spine' src/` -- returns 0 hits
3. `test -f src/components/today/overdue-commitments.tsx` -- returns false (file deleted)
4. `grep -q "DROP TRIGGER IF EXISTS interactions_update_cycle" supabase/migrations/slice-2a-drop-spine.sql` -- returns exit 0
5. `pnpm typecheck` -- PASS
6. `pnpm build` -- PASS
</verification>

<success_criteria>
- supabase/migrations/slice-2a-drop-spine.sql exists on disk with correct content (trigger drop first, then 5 table drops)
- src/app/api/spine/ directory does not exist
- src/lib/spine/ directory does not exist
- src/components/today/overdue-commitments.tsx, week-stats.tsx, tier-alerts.tsx, today-focus.tsx, recent-captures.tsx do not exist
- src/app/(app)/today/page.tsx has zero spine references
- src/app/(app)/today/today-client.tsx has zero spine references and zero references to deleted components
- src/components/dashboard/task-list.tsx spine comment cleaned
- SCHEMA.md shows all 5 spine tables as "dropped", last-updated 2026-04-23
- BLOCKERS.md WR-05 moved to Resolved
- BUILD.md has 2026-04-23 Slice 2A entry in Built section
- pnpm typecheck passes
- pnpm build passes
- Alex has the migration file ready to execute manually in Supabase SQL Editor
</success_criteria>

<output>
After completion, create `/Users/alex/crm/.planning/phases/002-slice-2a-spine-drop/002-01-SUMMARY.md`
</output>
