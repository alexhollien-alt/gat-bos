---
phase: 001-slice-1-activity-ledger
fixed_at: 2026-04-22
review_path: .planning/phases/001-slice-1-activity-ledger/001-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 001: Code Review Fix Report

**Fixed at:** 2026-04-22
**Source review:** `.planning/phases/001-slice-1-activity-ledger/001-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 critical + 5 warnings)
- Fixed: 6
- Skipped: 0

---

## Fixed Issues

### CR-01: Empty OWNER_USER_ID silently inserts invalid actor/user IDs

**Files modified:** `src/lib/activity/writeEvent.ts`, `src/lib/captures/promote.ts`, `src/app/(app)/tickets/[id]/actions.ts`
**Commit:** `84eac8e`
**Applied fix:** Replaced `process.env.OWNER_USER_ID ?? ''` module-level constant in `writeEvent.ts` with a startup throw:
```ts
const OWNER_USER_ID = process.env.OWNER_USER_ID;
if (!OWNER_USER_ID) {
  throw new Error('[writeEvent] OWNER_USER_ID is not set. Activity ledger cannot write events.');
}
```
Changed all three `process.env.OWNER_USER_ID ?? ''` inline reads in `promote.ts` to `process.env.OWNER_USER_ID!`. Changed the same `?? ''` pattern in `actions.ts` to `!`. The module-level throw in `writeEvent.ts` is the authoritative validation; the `!` assertions at call sites acknowledge that if the module loaded, the env var is present.

---

### WR-01: handleSaveNotes mutates material_requests without emitting an activity event

**Files modified:** `src/lib/activity/types.ts`, `src/app/(app)/tickets/[id]/actions.ts`, `src/app/(app)/tickets/[id]/page.tsx`
**Commit:** `c0765e2`
**Applied fix:**
- Added `'ticket.notes_updated'` to the `ActivityVerb` union in `types.ts`.
- Added `updateTicketNotes(ticketId, notes)` Server Action to `actions.ts`. It fetches `contact_id` from the ticket row (so the event appears in per-contact timelines), writes via `adminClient`, and emits a `ticket.notes_updated` event with `contact_id` in context when available.
- Replaced the direct `supabase.from("material_requests").update(...)` call in `handleSaveNotes` in `page.tsx` with `await updateTicketNotes(ticket.id, notes)`. Local state is updated on success.

---

### WR-02: email.sent event written without contact_id

**Files modified:** `src/app/api/email/approve-and-send/route.ts`
**Commit:** `dbe8623`
**Applied fix:** Added `contact_id: string | null` to the `EmailRow` interface. Added `contact_id` to the emails SELECT query (already fetched just before the writeEvent call for the send action). Updated the `writeEvent` call to spread `contact_id` into context conditionally -- skipped if null. Also changed `actorId: process.env.OWNER_USER_ID ?? ''` to `process.env.OWNER_USER_ID!` for consistency. Removed the stale Slice 2 deferral comment.

---

### WR-03: Backfill null-guard on occurred_at and 7-day window exclusion

**Files modified:** `scripts/backfill-activity-events.mjs`
**Commit:** `c63676f`
**Applied fix:** Removed the `.gte('created_at', sevenDaysAgo)` filter entirely so the backfill covers all interactions in history. Added `created_at` to the SELECT list so the fallback is available in scope. Changed the insert to use `interaction.occurred_at ?? interaction.created_at ?? new Date().toISOString()` so rows with null `occurred_at` still land with a sensible timestamp. Added `nullsFirst: false` to the `order()` call so null `occurred_at` rows sort last rather than unpredictably. The idempotency check was already correct and unchanged.

---

### WR-04: GIN index on context->>'contact_id' missing from DDL

**Files modified:** `supabase/migrations/20260422110000_activity_events_contact_id_index.sql` (new file)
**Commit:** `09b6096`
**Applied fix:** Created a new migration with a partial btree expression index:
```sql
create index if not exists activity_events_context_contact_id_idx
  on public.activity_events ((context->>'contact_id'))
  where context->>'contact_id' is not null;
```
Uses btree (default), not GIN -- GIN is for jsonb containment operators (`@>`); this predicate is text equality on the extracted value. The `WHERE` clause keeps the index small by excluding rows without a `contact_id` in context. Matches the `getContactTimeline` OR-filter access pattern.

---

### WR-05: interactions_update_cycle trigger still live -- logged to BLOCKERS.md

**Files modified:** `BLOCKERS.md`
**Commit:** `a1da7e2`
**Applied fix:** Added a new entry under `## Open` documenting the live `interactions_update_cycle` trigger, where it is defined, and the exact `DROP TRIGGER IF EXISTS` statement that must run as the first step of the Slice 2B plumbing session before spine tables are dropped. Per the REVIEW.md fix guidance, this is correctly handled as a BLOCKERS.md entry rather than a live migration at this stage (the trigger is harmless until the DROP, and dropping it mid-Slice 1 without also dropping the referenced function and tables would leave orphaned DDL).

---

## Skipped Issues

None -- all 6 in-scope findings were applied.

---

## Final Verification

**pnpm typecheck:** PASS
**pnpm build:** PASS

All routes built cleanly. `/tickets/[id]` route: 7.77 kB (unchanged bundle profile). No new TypeScript errors introduced.

---

_Fixed: 2026-04-22_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
