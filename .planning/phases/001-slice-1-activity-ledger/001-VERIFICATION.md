---
phase: 001-slice-1-activity-ledger
verified: 2026-04-22T00:00:00Z
status: passed
score: 15/15 must-haves verified
overrides_applied: 0
gaps: []
human_verification: []
---

# Phase 001: Slice 1 Activity Ledger Verification Report

**Phase Goal:** Create the universal activity ledger (`activity_events` table) as the canonical write path for every user-observable action in GAT-BOS. Retrofit five highest-traffic write paths to emit events. Backfill one week of prior interactions. Update the contact detail page to read its timeline from the ledger. Deprecate spine files with comments.
**Verified:** 2026-04-22
**Status:** PASSED
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `writeEvent()` exists, accepts correct args, never throws, uses adminClient | VERIFIED | `src/lib/activity/writeEvent.ts` L21 -- `export async function writeEvent(input: WriteEventInput): Promise<void>` with adminClient import at L8 and logError swallow at L34 |
| 2 | `getContactTimeline()` and `getRecentActivity()` return ActivityEvent[] from activity_events | VERIFIED | `src/lib/activity/queries.ts` L9-L26 and L28-L41 -- both exported, both hit `.from('activity_events')` |
| 3 | `ActivityVerb` union type covers all 13 verbs; `ActivityEvent` interface matches DB columns | VERIFIED | `src/lib/activity/types.ts` -- 13 `| '...'` members confirmed by grep; interface has all 10 DB columns |
| 4 | `activity_events` migration exists with all 10 columns, 3 indexes, RLS | VERIFIED | `supabase/migrations/20260422100000_activity_events.sql` -- 10-column `CREATE TABLE IF NOT EXISTS`, 3 `CREATE INDEX IF NOT EXISTS`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `CREATE POLICY "owner_read_write"` |
| 5 | capture.promoted emits writeEvent (3 branches, fire-and-forget) | VERIFIED | `src/lib/captures/promote.ts` L102, L141, L181 -- all 3 are `void writeEvent(...)` |
| 6 | email.sent emits writeEvent after send_now succeeds | VERIFIED | `src/app/api/email/approve-and-send/route.ts` L338 -- `void writeEvent(...)` with `verb: 'email.sent'` |
| 7 | project.updated emits writeEvent after PATCH succeeds | VERIFIED | `src/app/api/projects/[id]/route.ts` L76 -- `void writeEvent(...)` with `verb: 'project.updated'` |
| 8 | event.created emits writeEvent after calendar row insert | VERIFIED | `src/app/api/calendar/create/route.ts` L95 -- `void writeEvent(...)` with `verb: 'event.created'` |
| 9 | ticket.status_changed emits writeEvent via Server Action with from_status + to_status + contact_id | VERIFIED | `src/app/(app)/tickets/[id]/actions.ts` L14 -- `'use server'`, L43 `void writeEvent(...)`, context includes `from_status`, `to_status`, conditional `contact_id` spread |
| 10 | Ticket page uses Server Action instead of direct supabase.update in handleStatusChange | VERIFIED | `src/app/(app)/tickets/[id]/page.tsx` L20 -- `import { updateTicketStatus } from "./actions"`, L71 -- `await updateTicketStatus(ticket.id, ticket.status, newStatus)`. No direct `material_requests` update call in page |
| 11 | Contact detail page reads Activity Feed from `getContactTimeline` with `buildActivityFeed` fallback | VERIFIED | `src/app/(app)/contacts/[id]/page.tsx` L19 import + L180 call + L206-207 fallback to `buildActivityFeed` when `ledgerTimeline.length === 0` |
| 12 | Backfill script exists as `.mjs`, uses `readFileSync`, has `maybeSingle()` idempotency check | VERIFIED | `scripts/backfill-activity-events.mjs` -- L12 `import { readFileSync }`, L71 `.maybeSingle()` on activity_events existence check before insert. Zero hits for `dotenv`, `ts-node`, `require(` |
| 13 | All three `src/lib/spine/*.ts` files have DEPRECATED comment at line 1 | VERIFIED | `head -1` of parser.ts, queries.ts, types.ts all return `// DEPRECATED (Slice 1, 2026-04-22): spine is superseded by activity_events.` |
| 14 | All three spine migration SQL files have DEPRECATED comment at line 1 | VERIFIED | `head -1` of 20260407020000_spine_tables.sql, 20260407021000_spine_interactions_trigger.sql, 20260408001000_cleanup_spine_smoke_test_data.sql all return `-- DEPRECATED (Slice 1, 2026-04-22): spine tables superseded by activity_events. Will be dropped in Slice 2.` |
| 15 | `CLAUDE.md` has Architecture Notes section referencing `activity_events` as canonical and spine as deprecated | VERIFIED | `CLAUDE.md` L101-L107 -- `## Architecture Notes (Slice 1+)` section with `activity_events` canonical statement, `writeEvent()` reference, spine deprecation list, and `getContactTimeline()` reference |

**Score:** 15/15 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260422100000_activity_events.sql` | Idempotent DDL for activity_events table, indexes, RLS | VERIFIED | 35-line file. CREATE TABLE IF NOT EXISTS (10 cols), 3 CREATE INDEX IF NOT EXISTS, ENABLE ROW LEVEL SECURITY, DROP/CREATE POLICY |
| `src/lib/activity/types.ts` | ActivityVerb union type (13 members) + ActivityEvent interface | VERIFIED | 31 lines. 13-member union, 10-field interface |
| `src/lib/activity/writeEvent.ts` | writeEvent() fire-and-forget using adminClient | VERIFIED | 41 lines. adminClient import, logError import, correct signature, no throw on error |
| `src/lib/activity/queries.ts` | getContactTimeline() and getRecentActivity() | VERIFIED | 41 lines. Both functions exported, both use browser createClient, OR filter on contact_id |
| `src/lib/captures/promote.ts` | writeEvent call after successful promote (3 branches) | VERIFIED | 3 void writeEvent calls at L102, L141, L181 |
| `src/app/api/email/approve-and-send/route.ts` | writeEvent call after send_now succeeds | VERIFIED | void writeEvent at L338 |
| `src/app/api/projects/[id]/route.ts` | writeEvent call after PATCH succeeds | VERIFIED | void writeEvent at L76 |
| `src/app/api/calendar/create/route.ts` | writeEvent call after local event row inserted | VERIFIED | void writeEvent at L95 |
| `src/app/(app)/tickets/[id]/actions.ts` | Server Action with 'use server', adminClient, writeEvent | VERIFIED | 56 lines. 'use server' at L1, adminClient + writeEvent imports, updateTicketStatus exported |
| `src/app/(app)/tickets/[id]/page.tsx` | handleStatusChange calls updateTicketStatus Server Action | VERIFIED | L20 import, L71 call -- no direct material_requests.update in handleStatusChange |
| `src/app/(app)/contacts/[id]/page.tsx` | getContactTimeline with buildActivityFeed fallback | VERIFIED | L19 + L180 (getContactTimeline), L18 + L207 (buildActivityFeed fallback) |
| `scripts/backfill-activity-events.mjs` | .mjs, readFileSync, maybeSingle idempotency | VERIFIED | readFileSync env load, maybeSingle at L71, no dotenv/ts-node/require |
| `src/lib/spine/parser.ts` | DEPRECATED comment at line 1 | VERIFIED | `// DEPRECATED (Slice 1, 2026-04-22)...` |
| `src/lib/spine/queries.ts` | DEPRECATED comment at line 1 | VERIFIED | `// DEPRECATED (Slice 1, 2026-04-22)...` |
| `src/lib/spine/types.ts` | DEPRECATED comment at line 1 | VERIFIED | `// DEPRECATED (Slice 1, 2026-04-22)...` |
| `CLAUDE.md` | Architecture Notes section | VERIFIED | L101-L107 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/activity/writeEvent.ts` | `src/lib/supabase/admin.ts` | adminClient import | VERIFIED | L8: `import { adminClient } from '@/lib/supabase/admin'` |
| `src/lib/activity/queries.ts` | activity_events table | `.from('activity_events')` | VERIFIED | L14 and L31: `.from('activity_events')` |
| `src/lib/captures/promote.ts` | `src/lib/activity/writeEvent.ts` | writeEvent import | VERIFIED | L3: `import { writeEvent } from "@/lib/activity/writeEvent"` |
| `src/app/(app)/tickets/[id]/page.tsx` | `src/app/(app)/tickets/[id]/actions.ts` | updateTicketStatus import | VERIFIED | L20: `import { updateTicketStatus } from "./actions"` |
| `src/app/(app)/contacts/[id]/page.tsx` | `src/lib/activity/queries.ts` | getContactTimeline import | VERIFIED | L19: `import { getContactTimeline } from '@/lib/activity/queries'` |
| `scripts/backfill-activity-events.mjs` | activity_events table | adminClient insert | VERIFIED | `.from('activity_events').insert(...)` pattern present in script |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/app/(app)/contacts/[id]/page.tsx` | `ledgerTimeline` | `getContactTimeline(contactId)` via browser Supabase client | Yes -- queries `activity_events` with OR filter; falls back to `buildActivityFeed` if empty | FLOWING |
| `scripts/backfill-activity-events.mjs` | `interactions` | `adminClient.from('interactions').select(...)` | Yes -- real DB query with 7-day window | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for server-side DB writes and migration -- these require a live Supabase connection and dev server to test end-to-end. No static entry point testable without network access.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SLICE-1-T2 | Wave 1 | SCHEMA.md at repo root | VERIFIED | `SCHEMA.md` exists (not listed in task criteria but confirmed in plan success criteria) |
| SLICE-1-T3 | Wave 1 | activity_events migration | VERIFIED | `supabase/migrations/20260422100000_activity_events.sql` |
| SLICE-1-T4 | Wave 1 | types.ts ActivityVerb + ActivityEvent | VERIFIED | `src/lib/activity/types.ts` |
| SLICE-1-T5 | Wave 1 | writeEvent() helper | VERIFIED | `src/lib/activity/writeEvent.ts` |
| SLICE-1-T6 | Wave 1 | getContactTimeline() + getRecentActivity() | VERIFIED | `src/lib/activity/queries.ts` |
| SLICE-1-T7 | Wave 2 | Retrofit 5 write paths + Server Action | VERIFIED | 7 total void writeEvent calls across 5 files, Server Action owns ticket path |
| SLICE-1-T8 | Wave 3 | Contact timeline reads from ledger | VERIFIED | contacts page L19, L180, L207 |
| SLICE-1-T9 | Wave 3 | Backfill script (idempotent .mjs) | VERIFIED | `scripts/backfill-activity-events.mjs` with maybeSingle check |
| SLICE-1-T10 | Wave 3 | Spine deprecation comments | VERIFIED | All 3 TS files + 3 SQL migration files |
| SLICE-1-T11 | Wave 3 | CLAUDE.md Architecture Notes | VERIFIED | CLAUDE.md L101-L107 |

---

### Anti-Patterns Found

No blockers or warnings found in the files modified by this phase.

Notable: `void writeEvent(...)` is used consistently across all 7 call sites -- none use `await writeEvent`. This is the correct fire-and-forget pattern. No TODO/FIXME/placeholder patterns found in the activity lib or retrofit files.

---

### Human Verification Required

None. All must-haves are verifiable programmatically.

Note: The migration SQL must be applied in Supabase for the runtime behaviour to work. The plans document this as a blocking human gate (Task 0 in Wave 1, "migration done" resume signal). Whether Alex has run it in the Supabase SQL Editor is outside static code verification scope.

---

### Gaps Summary

No gaps. All 15 must-haves verified against the codebase.

---

_Verified: 2026-04-22_
_Verifier: Claude (gsd-verifier)_
