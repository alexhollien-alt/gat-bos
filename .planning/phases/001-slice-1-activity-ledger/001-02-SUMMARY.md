---
phase: 001-slice-1-activity-ledger
plan: "02"
subsystem: database
tags: [activity-ledger, supabase, server-actions, fire-and-forget, typescript]

# Dependency graph
requires:
  - phase: 001-slice-1-activity-ledger
    plan: "01"
    provides: writeEvent helper at src/lib/activity/writeEvent.ts and activity_events DDL
provides:
  - void writeEvent calls on 5 highest-traffic write paths (capture promote, email send, project PATCH, calendar create, ticket status change)
  - Server Action updateTicketStatus replacing direct browser supabase.update for ticket status changes
  - contact_id included in capture.promoted and ticket.status_changed events for per-contact timeline indexing
  - Slice 2 deferral comments on email.sent, project.updated, event.created (no contact_id available without join)
affects:
  - wave-3 (contact timeline reads from activity_events -- these events are now being written)
  - future ticket pages (Server Action pattern established)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget writeEvent: void writeEvent(...) after every successful write, never awaited"
    - "Server Action for client component mutations requiring adminClient: 'use server' + adminClient + writeEvent"
    - "contact_id propagation: fetch from row before write, spread into context when truthy"

key-files:
  created:
    - src/app/(app)/tickets/[id]/actions.ts
  modified:
    - src/lib/captures/promote.ts
    - src/app/api/email/approve-and-send/route.ts
    - src/app/api/projects/[id]/route.ts
    - src/app/api/calendar/create/route.ts
    - src/app/(app)/tickets/[id]/page.tsx

key-decisions:
  - "writeEvent placed AFTER each success return-point so failures in the ledger write never block or alter the HTTP response"
  - "ticket status change wrapped in Server Action (not direct browser call) because writeEvent uses adminClient (service-role) which must not run in browser"
  - "contact_id fetched from material_requests row before the update query so it is available for writeEvent context even though the update itself does not need it"
  - "email.sent, project.updated, event.created defer contact_id to Slice 2 -- documented with inline comments"
  - "calendar event.created fires BEFORE Step 2 (gcal write) so the activity event is recorded even if gcal fails"

patterns-established:
  - "Fire-and-forget pattern: void writeEvent(...) -- the void prefix suppresses the floating Promise lint warning"
  - "Server Action boundary: client components that need adminClient must route through a 'use server' file"
  - "contact_id strategy: pre-fetch then spread -- ...(row?.contact_id ? { contact_id: row.contact_id } : {})"

requirements-completed: [SLICE-1-T7]

# Metrics
duration: 18min
completed: 2026-04-22
---

# Phase 001 Plan 02: Wave 2 -- Write Path Instrumentation Summary

**Five highest-traffic write paths now emit fire-and-forget activity events to the ledger, with a Server Action wrapper for ticket status changes that fetches and forwards contact_id.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-22T00:00:00Z
- **Completed:** 2026-04-22
- **Tasks:** 2
- **Files modified:** 6 (5 modified, 1 created)

## Accomplishments

- Retrofitted `promote.ts` with 3 `void writeEvent` calls (one per promote branch: interaction, follow_up, ticket) including contact_id from `parsed_contact_id`
- Added `void writeEvent` to `approve-and-send/route.ts` after send_now succeeds (email.sent verb)
- Added `void writeEvent` to `projects/[id]/route.ts` after PATCH succeeds (project.updated verb with updated_fields list)
- Added `void writeEvent` to `calendar/create/route.ts` after local row insert succeeds and before gcal write (event.created verb)
- Created `tickets/[id]/actions.ts` Server Action that pre-fetches contact_id, performs the update, and fires ticket.status_changed with from_status, to_status, and contact_id
- Updated `tickets/[id]/page.tsx` to call `updateTicketStatus` Server Action instead of direct `supabase.from('material_requests').update` in handleStatusChange
- `pnpm typecheck` and `pnpm build` both pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Retrofit capture promote, email send, project PATCH, and calendar create** - `b692c59` (feat)
2. **Task 2: Create ticket Server Action and update page to call it** - `354ad06` (feat)

## Files Created/Modified

- `src/lib/captures/promote.ts` -- Added writeEvent import; 3 void writeEvent calls after interaction/follow_up/ticket insert success; contact_id from parsed_contact_id
- `src/app/api/email/approve-and-send/route.ts` -- Added writeEvent import; void writeEvent after fireMarkRead in send_now success branch
- `src/app/api/projects/[id]/route.ts` -- Added writeEvent import; void writeEvent after PATCH .single() succeeds, before NextResponse.json(data)
- `src/app/api/calendar/create/route.ts` -- Added writeEvent import; void writeEvent after local insert, before Step 2 gcal write
- `src/app/(app)/tickets/[id]/actions.ts` -- New Server Action file; pre-fetches contact_id, updates material_requests, fires ticket.status_changed event
- `src/app/(app)/tickets/[id]/page.tsx` -- Added import for updateTicketStatus; handleStatusChange replaced with Server Action call

## Decisions Made

- Placed writeEvent after success but before the return statement so the activity event fires on every successful write without blocking the response path
- Used `void writeEvent(...)` (not `await`) at all 7 call sites -- this is fire-and-forget; the void prefix suppresses the floating Promise TypeScript/ESLint warning
- calendar/create: writeEvent fires before the gcal Step 2 so the event is always recorded even if Google Calendar write fails
- Ticket status change required a Server Action because `writeEvent` uses `adminClient` (service-role key) which must not be imported into browser bundles
- contact_id pre-fetch in the Server Action uses `.maybeSingle()` -- if the fetch fails, the spread condition evaluates to false and context omits contact_id silently

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

Wave 3 (contact timeline page) is ready to proceed. `getContactTimeline` from `src/lib/activity/queries.ts` (Wave 1) now has events flowing into `activity_events` from all 5 retrofitted paths. The contact detail page can replace its five-table union with a single `getContactTimeline(contactId)` call and surface these events immediately (once the migration is live in Supabase).

Blocking dependency: the `activity_events` migration must be pasted into Supabase SQL Editor before any runtime reads or writes will succeed. Wave 1 SUMMARY documented this as a human-action checkpoint.

---
*Phase: 001-slice-1-activity-ledger*
*Completed: 2026-04-22*
