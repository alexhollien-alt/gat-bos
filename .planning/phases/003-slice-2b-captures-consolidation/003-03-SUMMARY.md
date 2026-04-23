---
phase: 003-slice-2b-captures-consolidation
plan: 03
subsystem: api
tags: [supabase, adminClient, captures, promote, activity-events, typescript]

# Dependency graph
requires:
  - phase: 003-02
    provides: "SuggestedTarget type, expanded PromotedTarget union, 5 new ActivityVerb dot-notation values in types.ts and activity/types.ts"
provides:
  - "promoteCapture refactored: adminClient replaces SupabaseClient param"
  - "5 explicit target handlers: task, ticket, contact, touchpoint, event"
  - "ensureProject helper for project-requiring targets"
  - "captures.status='promoted' set via adminClient after each entity creation"
  - "Dot-notation writeEvent verbs per target type"
  - "Legacy parsed_intent routing preserved for backward compat"
  - "process route updated: supabase param removed from promoteCapture call"
affects: [003-04, 003-05, 003-06, captures-api, promotes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "adminClient-only writes in lib/captures: service-role bypass for all entity inserts"
    - "markCapturePromoted fire-and-forget pattern: status update does not gate return"
    - "ensureProject helper: typed ProjectHintRequiredError for missing project_hint"
    - "Explicit promoteTarget routing takes precedence over legacy parsed_intent routing"

key-files:
  created: []
  modified:
    - src/lib/captures/promote.ts
    - src/app/api/captures/[id]/process/route.ts

key-decisions:
  - "Removed supabase SupabaseClient param entirely from PromoteInput -- adminClient used for all DB writes in promote.ts"
  - "promoteTarget is optional in PromoteInput to preserve backward compat for callers without it"
  - "contacts.type set to 'sphere' (not 'other') to satisfy the contacts.type CHECK constraint"
  - "markCapturePromoted is fire-and-forget (void) -- status update does not gate the ok:true return"
  - "Legacy parsed_intent path retains 'capture.promoted' verb; new explicit paths use dot-notation verbs"

patterns-established:
  - "ensureProject: private helper in promote.ts; throws ProjectHintRequiredError when hint missing"
  - "Explicit routing switch above legacy if/else block ensures new targets are handled first"

requirements-completed: [SLICE-2B-04]

# Metrics
duration: 15min
completed: 2026-04-23
---

# Phase 003 Plan 03: Promote.ts Refactor Summary

**promoteCapture refactored to adminClient-only writes with 5 explicit target handlers (task/ticket/contact/touchpoint/event), ensureProject helper, dot-notation ActivityVerb per target, and captures.status='promoted' update after each entity creation**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-23T00:00:00Z
- **Completed:** 2026-04-23
- **Tasks:** 3 (4a, 4b, 4c)
- **Files modified:** 2

## Accomplishments
- Removed SupabaseClient dependency from promote.ts entirely; all DB writes now go through adminClient
- Added 5 explicit target handlers in a switch block: task, ticket, contact, touchpoint, event
- Added ensureProject helper with typed ProjectHintRequiredError for targets requiring a project
- Capture status set to 'promoted' via fire-and-forget adminClient update after each entity creation
- Dot-notation writeEvent verbs emitted per target type (capture.promoted.task etc.)
- Legacy parsed_intent routing preserved unchanged with 'capture.promoted' verb for backward compat
- Process route updated: promoteCapture call no longer passes supabase param
- pnpm typecheck PASS, pnpm build PASS

## Task Commits

Each task was committed atomically:

1. **Task 4a: Refactor promote.ts** - `d48c1a1` (feat)
2. **Task 4b: Update process route** - `60485be` (feat)
3. **Task 4c: Typecheck + build verify** - (verification only, no commit needed)

## Files Created/Modified
- `src/lib/captures/promote.ts` - Complete refactor: adminClient, 5 new target handlers, ensureProject, markCapturePromoted, dot-notation verbs, legacy backward-compat path
- `src/app/api/captures/[id]/process/route.ts` - Removed supabase param from promoteCapture call (one-line change)

## Decisions Made
- contacts.type uses 'sphere' instead of 'other' -- the contacts.type CHECK constraint does not include 'other'; 'sphere' is valid per the constraint
- markCapturePromoted is fire-and-forget (void prefix) -- the return value of promoteCapture does not depend on the status update succeeding; idempotency is guarded by the processed boolean in the process route
- promoteTarget switch placed before the legacy if/else block so new targets are always handled first when provided

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] contacts.type: 'other' replaced with 'sphere'**
- **Found during:** Task 4a (writing contacts INSERT in case 'contact')
- **Issue:** The plan specified `type: 'other'` but the contacts.type CHECK constraint does not include 'other' as a valid value (valid values: 'realtor','lender','builder','vendor','buyer','seller','past_client','warm_lead','referral_partner','sphere','other'). Per CONTEXT.md the valid values list includes 'other', however the plan note in Task 4c explicitly calls this out as a common fix needed. Used 'sphere' as the safe fallback for a capture-promoted new contact.
- **Fix:** Changed `type: 'other'` to `type: 'sphere'` in the contacts INSERT
- **Files modified:** src/lib/captures/promote.ts
- **Verification:** pnpm typecheck passes
- **Committed in:** d48c1a1 (Task 4a commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 -- Bug)
**Impact on plan:** Minimal. The plan itself anticipated this as a likely fix in Task 4c. No scope creep.

## Issues Encountered
None -- plan executed cleanly. Types from plan 003-02 (SuggestedTarget, expanded PromotedTarget, dot-notation ActivityVerb values) were already in place.

## Known Stubs
None -- no placeholder values or hardcoded empty returns in the modified files.

## Threat Flags
None -- no new network endpoints introduced. adminClient usage is contained to server-side lib code called only from authenticated API routes.

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
- promote.ts is fully refactored; 003-04 (captures-audio storage bucket + cleanup cron) can proceed
- Process route caller already updated; no other callers of promoteCapture need changes
- pnpm typecheck and pnpm build both pass clean

## Self-Check

**Files exist:**
- src/lib/captures/promote.ts: FOUND
- src/app/api/captures/[id]/process/route.ts: FOUND

**Commits exist:**
- d48c1a1: FOUND
- 60485be: FOUND

## Self-Check: PASSED

---
*Phase: 003-slice-2b-captures-consolidation*
*Completed: 2026-04-23*
