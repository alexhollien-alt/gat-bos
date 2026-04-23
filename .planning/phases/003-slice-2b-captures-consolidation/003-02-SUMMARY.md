---
phase: 003-slice-2b-captures-consolidation
plan: "02"
subsystem: captures
tags: [types, typescript, captures, activity-verbs]
dependency_graph:
  requires: [003-01]
  provides: [PromotedTarget-7-members, SuggestedTarget, Capture-extended, ActivityVerb-capture-promoted-variants]
  affects: [src/lib/types.ts, src/lib/activity/types.ts, src/app/(app)/captures/captures-client.tsx]
tech_stack:
  added: []
  patterns: [exhaustive-record-union, dot-notation-activity-verbs]
key_files:
  modified:
    - src/lib/types.ts
    - src/lib/activity/types.ts
    - src/app/(app)/captures/captures-client.tsx
decisions:
  - "SuggestedTarget placed immediately after PromotedTarget declaration in types.ts"
  - "New Capture fields (source, status) placed before existing created_at/updated_at to group schema columns logically"
  - "PROMOTED_LABELS in captures-client.tsx extended to satisfy exhaustive Record<PromotedTarget, string> -- Rule 1 auto-fix"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-23T19:00:42Z"
  tasks_completed: 3
  files_modified: 3
---

# Phase 003 Plan 02: TypeScript Type Definitions for Slice 2B Summary

Extended TypeScript contracts covering the Slice 2B captures schema: 7-member PromotedTarget union, new SuggestedTarget type, 5 new Capture interface fields, and 5 new dot-notation ActivityVerb values for granular capture promotion tracking.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 3a | Extend types.ts -- PromotedTarget, SuggestedTarget, Capture | 49ef625 | src/lib/types.ts |
| 3b | Extend activity/types.ts -- 5 new ActivityVerb values | 49ef625 | src/lib/activity/types.ts |
| 3c | Typecheck | 49ef625 | src/app/(app)/captures/captures-client.tsx |

## Changes Made

### src/lib/types.ts

**PromotedTarget** expanded from 3 to 7 members:
- Before: `"interaction" | "follow_up" | "ticket"`
- After: adds `"task" | "contact" | "touchpoint" | "event"`

**SuggestedTarget** added as a new exported type:
```typescript
export type SuggestedTarget = {
  type?: 'task' | 'ticket' | 'contact' | 'touchpoint' | 'event'
  project_hint?: { name: string; contact_id?: string }
  contact_id?: string
}
```

**Capture interface** extended with 5 new fields:
- `source: string` -- DB column, default 'manual'
- `suggested_target?: SuggestedTarget | null`
- `transcript?: string | null`
- `metadata?: Record<string, unknown> | null`
- `status: string` -- DB column, default 'pending'

### src/lib/activity/types.ts

5 new dot-notation verbs added after `'capture.promoted'`:
- `'capture.promoted.task'`
- `'capture.promoted.ticket'`
- `'capture.promoted.contact'`
- `'capture.promoted.touchpoint'`
- `'capture.promoted.event'`

Legacy `'capture.promoted'` verb preserved for backward compatibility.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PROMOTED_LABELS exhaustiveness error in captures-client.tsx**
- **Found during:** Task 3c (typecheck)
- **Issue:** `const PROMOTED_LABELS: Record<PromotedTarget, string>` had only 3 entries; TypeScript reported TS2739 after PromotedTarget grew to 7 members
- **Fix:** Added 4 new entries (task, contact, touchpoint, event) to the object literal
- **Files modified:** src/app/(app)/captures/captures-client.tsx
- **Commit:** 49ef625

## Verification

```
pnpm typecheck -- PASS (exit 0)
```

Acceptance criteria checks:
- grep -n "SuggestedTarget" src/lib/types.ts -- 3 lines (declaration + Capture field + CapturePayload reference via PromotedTarget)
- grep -n "'task'" src/lib/types.ts -- present in PromotedTarget and SuggestedTarget
- grep -n "source: string" src/lib/types.ts -- line 478 inside Capture
- grep -n "status: string" src/lib/types.ts -- line 482 inside Capture
- grep -n "transcript" src/lib/types.ts -- line 480 inside Capture
- grep -n "metadata" src/lib/types.ts -- line 481 inside Capture
- grep -c "capture\.promoted\." src/lib/activity/types.ts -- 5
- grep -n "capture\.promoted'" src/lib/activity/types.ts -- line 9 (legacy, no dot suffix)
- grep "capture_promoted" src/lib/activity/types.ts -- 0 (no underscores)
- ParsedIntent, CapturePayload, PARSED_INTENT_LABELS -- unchanged

## Known Stubs

None. This plan is types-only; no runtime data flows or UI rendering introduced.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced (types are compile-time only).

## Self-Check: PASSED

- src/lib/types.ts: modified, PromotedTarget has 7 members, SuggestedTarget exported, Capture has 5 new fields
- src/lib/activity/types.ts: modified, 5 new dot-notation verbs present, legacy preserved
- src/app/(app)/captures/captures-client.tsx: auto-fixed exhaustiveness error
- Commit 49ef625 exists: `git log --oneline | grep 49ef625`
- pnpm typecheck: PASS
