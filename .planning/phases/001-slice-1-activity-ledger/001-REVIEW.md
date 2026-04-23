---
phase: 001-slice-1-activity-ledger
reviewed: 2026-04-22T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/app/(app)/tickets/[id]/actions.ts
  - src/lib/captures/promote.ts
  - src/app/api/email/approve-and-send/route.ts
  - src/app/api/projects/[id]/route.ts
  - src/app/api/calendar/create/route.ts
  - src/app/(app)/tickets/[id]/page.tsx
  - scripts/backfill-activity-events.mjs
  - src/app/(app)/contacts/[id]/page.tsx
  - src/lib/spine/parser.ts
  - src/lib/spine/queries.ts
  - src/lib/spine/types.ts
  - supabase/migrations/20260407020000_spine_tables.sql
  - supabase/migrations/20260407021000_spine_interactions_trigger.sql
  - supabase/migrations/20260408001000_cleanup_spine_smoke_test_data.sql
  - CLAUDE.md
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 001: Code Review Report

**Reviewed:** 2026-04-22
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This review covers the Slice 1 activity ledger -- the `activity_events` table, the `writeEvent()` helper, five retrofitted write paths, the contact detail page wired to `getContactTimeline`, and the backfill script. The architecture is sound: service-role writes are isolated to server-side paths, the fire-and-forget pattern is used consistently, and the fallback to `buildActivityFeed` is a clean degradation strategy.

One critical issue exists: the `writeEvent` helper uses `OWNER_USER_ID` from a module-level constant that defaults to the empty string when the env var is absent. Every call site in `promote.ts` reads `process.env.OWNER_USER_ID ?? ''` inline instead of importing the constant, meaning the empty-string fallback is duplicated and diverges if the helper's default changes. More critically, an empty `OWNER_USER_ID` is inserted as `actor_id` and `user_id` in every event row -- silently corrupting the ledger rather than raising an error.

Five warnings cover: an untracked notes mutation in the ticket page, the `email.sent` event missing `contact_id` (limiting its utility in the timeline), a correctness gap in the backfill query (7-day window uses `created_at` but sorts on `occurred_at`), the `activity_events` DDL missing a GIN index on `context` (needed for the `context->>contact_id` filter in `getContactTimeline`), and a deprecated spine trigger that is still active on the `interactions` table.

---

## Critical Issues

### CR-01: Empty OWNER_USER_ID silently inserts invalid actor/user IDs into activity_events

**File:** `src/lib/activity/writeEvent.ts:12` and `src/lib/captures/promote.ts:103,142,182`

**Issue:** `writeEvent.ts` declares `const OWNER_USER_ID = process.env.OWNER_USER_ID ?? ''` at module scope and uses it as `user_id` in every `activity_events` insert. All three `writeEvent` call sites in `promote.ts` independently read `process.env.OWNER_USER_ID ?? ''` as the `actorId` argument. If `OWNER_USER_ID` is unset in any deployment environment, every event is written with an empty string for both `user_id` and `actor_id`. The `activity_events` DDL declares these columns `NOT NULL uuid`, but Supabase/Postgres will reject the empty string at the DB level -- silently dropping all ledger writes and logging errors that may not surface in dev. No startup check or runtime guard catches this gap.

**Fix:** Add an explicit guard in `writeEvent.ts` and fail loud rather than inserting garbage. The module-level constant should also be the single source of truth so call sites cannot diverge:

```typescript
// src/lib/activity/writeEvent.ts
const OWNER_USER_ID = process.env.OWNER_USER_ID;
if (!OWNER_USER_ID) {
  throw new Error('OWNER_USER_ID env var is required for activity ledger writes');
}

// All call sites in promote.ts should use the imported constant, not inline reads:
// Change: actorId: process.env.OWNER_USER_ID ?? ''
// To:     actorId: OWNER_USER_ID   (import from writeEvent.ts or a shared constants file)
```

Alternatively, validate in `writeEvent()` itself and return early with a logged error if `actorId` is empty, so the guard is centralised:

```typescript
export async function writeEvent(input: WriteEventInput): Promise<void> {
  if (!input.actorId) {
    await logError('activity/writeEvent', 'actorId is empty -- OWNER_USER_ID not set', { verb: input.verb });
    return;
  }
  // ... rest of function
}
```

---

## Warnings

### WR-01: handleSaveNotes in ticket page mutates material_requests without emitting an activity event

**File:** `src/app/(app)/tickets/[id]/page.tsx:77-86`

**Issue:** `handleSaveNotes` calls `supabase.from("material_requests").update({ notes })` directly from the browser client. This bypasses both `updateTicketStatus` (which emits `ticket.status_changed`) and the `writeEvent` system entirely. Notes edits are invisible to the activity ledger. This is inconsistent with the retrofit pattern applied to status changes.

**Fix:** Move the notes save into a Server Action (alongside `updateTicketStatus` in `actions.ts`) that calls `adminClient` for the update and emits a `ticket.notes_updated` verb (or reuse `ticket.status_changed` with appropriate context). The page component would call the Server Action instead of `supabase` directly.

```typescript
// In actions.ts
export async function updateTicketNotes(
  ticketId: string,
  notes: string,
  contactId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await adminClient
    .from('material_requests')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', ticketId);
  if (error) return { ok: false, error: error.message };
  void writeEvent({
    actorId: OWNER_USER_ID,
    verb: 'ticket.status_changed',
    object: { table: 'material_requests', id: ticketId },
    context: { notes_updated: true, ...(contactId ? { contact_id: contactId } : {}) },
  });
  return { ok: true };
}
```

### WR-02: email.sent event written without contact_id, making it invisible in per-contact timelines

**File:** `src/app/api/email/approve-and-send/route.ts:336-343`

**Issue:** The `email.sent` event is emitted without `contact_id` in the context, with a Slice 2 deferral comment. `getContactTimeline` filters on `object_id.eq.${contactId}` OR `context->>contact_id.eq.${contactId}`. Since `email_drafts.object_id` is a draft UUID (not a contact UUID) and `contact_id` is absent from context, this event will never appear in any contact's activity feed. For a CRM whose central value is per-contact relationship history, this is a meaningful correctness gap rather than a mere enhancement.

The email row joins to contacts via `email_drafts -> emails -> contacts` and the data is already available one query away.

**Fix:** Add a join on insert to fetch `contact_id` before calling `writeEvent`:

```typescript
// After fetching `email`, add:
const { data: contactRow } = await adminClient
  .from('emails')
  .select('contact_id')
  .eq('id', draft.email_id)
  .maybeSingle();

void writeEvent({
  actorId: process.env.OWNER_USER_ID ?? '',
  verb: 'email.sent',
  object: { table: 'email_drafts', id: draftId },
  context: {
    email_id: draft.email_id,
    ...(contactRow?.contact_id ? { contact_id: contactRow.contact_id } : {}),
  },
});
```

### WR-03: Backfill script 7-day window uses created_at but orders by occurred_at -- interactions without occurred_at are silently excluded

**File:** `scripts/backfill-activity-events.mjs:38-45`

**Issue:** The query filters `.gte('created_at', sevenDaysAgo)` but orders by `.order('occurred_at', { ascending: true })`. If any interaction row has `occurred_at IS NULL`, the `order()` will place those rows arbitrarily (Postgres sorts NULLs last by default). More importantly, the window is gated on `created_at`, not `occurred_at`. Interactions back-dated to before the 7-day window (e.g., logging a meeting that happened 8 days ago) will be excluded from backfill even if they were created recently.

Additionally, if `occurred_at` is `NULL` on an inserted `activity_events` row, the `getContactTimeline` query (which orders by `occurred_at DESC`) will float those rows unpredictably.

**Fix:**

```javascript
// Use occurred_at for the window, with a NULL fallback to created_at
.gte('occurred_at', sevenDaysAgo)  // or use created_at if occurred_at is always populated

// Guard against NULL occurred_at before inserting:
occurred_at: interaction.occurred_at ?? interaction.created_at,
```

Also verify the `interactions` table schema to confirm whether `occurred_at` has a `NOT NULL` constraint. If it does, the `?? interaction.created_at` fallback is unnecessary but harmless.

### WR-04: activity_events DDL lacks a GIN index on context -- the contact_id filter in getContactTimeline will full-scan on large tables

**File:** `supabase/migrations/20260422100000_activity_events.sql:17-25`

**Issue:** `getContactTimeline` queries:
```
.or(`object_id.eq.${contactId},context->>contact_id.eq.${contactId}`)
```

The `context->>contact_id` arm uses JSONB text extraction. The three indexes created in the migration cover `(user_id, occurred_at)`, `(object_table, object_id, occurred_at)`, and `(actor_id, occurred_at)` -- none cover JSONB content. As the ledger grows, every `getContactTimeline` call will full-scan `context` for every row belonging to the user, even after the user-level index narrows to their rows.

**Fix:** Add a GIN index on the `context` column, or a narrower expression index on the extracted UUID:

```sql
-- Preferred: expression index on the specific key
CREATE INDEX IF NOT EXISTS idx_activity_events_context_contact_id
  ON public.activity_events ((context->>'contact_id'))
  WHERE context->>'contact_id' IS NOT NULL;
```

This is a migration-only fix and does not require application code changes.

### WR-05: spine_update_cycle_on_interaction trigger is still active on interactions table despite spine deprecation

**File:** `supabase/migrations/20260407021000_spine_interactions_trigger.sql:61-64`

**Issue:** The trigger `interactions_update_cycle` (created in this migration) fires `AFTER INSERT` on `public.interactions` and upserts into `cycle_state`. The migration file is marked deprecated and will be "dropped in Slice 2," but the trigger is live in the database right now. Every interaction logged during Slice 1 (including backfilled events via the script) continues to write to `cycle_state` -- a deprecated table. This is not a silent failure, but it is invisible technical debt that could cause confusion when Slice 2 drops `cycle_state` and any remaining trigger references become orphaned.

More specifically: the backfill script does NOT insert into `interactions` (it inserts into `activity_events` directly), so the trigger is only a risk for new interactions logged through the UI. But the intent to deprecate is not enforced.

**Fix:** Either drop the trigger now via a new migration, or document in `BLOCKERS.md` that it must be dropped as the first step of Slice 2 before dropping `cycle_state`:

```sql
-- supabase/migrations/202604XX_drop_spine_interaction_trigger.sql
DROP TRIGGER IF EXISTS interactions_update_cycle ON public.interactions;
DROP FUNCTION IF EXISTS public.spine_update_cycle_on_interaction();
```

---

## Info

### IN-01: project.updated event omits updated_fields list for no-op PATCH calls

**File:** `src/app/api/projects/[id]/route.ts:76-81`

**Issue:** The `writeEvent` call for `project.updated` includes `context: { updated_fields: Object.keys(sanitized) }`. However, `sanitized` always includes `updated_at` (set at line 59) even when no actual user-visible fields changed. A PATCH with an empty body would write an event with `updated_fields: ['updated_at']`, which is a misleading audit trail entry. This is an info-level concern because the single-user nature of GAT-BOS means no one is watching the ledger for abuse, but it will produce noise in future analytics.

**Fix:** Guard the event on whether any meaningful fields were updated:
```typescript
const meaningfulFields = Object.keys(sanitized).filter(k => k !== 'updated_at');
if (meaningfulFields.length > 0) {
  void writeEvent({
    actorId: process.env.OWNER_USER_ID ?? '',
    verb: 'project.updated',
    object: { table: 'projects', id },
    context: { updated_fields: meaningfulFields },
  });
}
```

### IN-02: Unused import ActivityEventRow type alias in contacts page

**File:** `src/app/(app)/contacts/[id]/page.tsx:20`

**Issue:** `import type { ActivityEvent as ActivityEventRow }` is imported but the alias `ActivityEventRow` is used only as the `useState` type annotation for `ledgerTimeline` (line 76: `useState<ActivityEventRow[]>`). The alias name `ActivityEventRow` is not referenced anywhere else; the original name `ActivityEvent` would be clearer. Minor naming inconsistency.

**Fix:** Either remove the alias:
```typescript
import type { ActivityEvent } from "@/lib/activity/types";
// ...
const [ledgerTimeline, setLedgerTimeline] = useState<ActivityEvent[]>([]);
```
Or rename the type to `ActivityEventRow` in `types.ts` if the intent was to distinguish it from the display-layer `ActivityEvent` type from `@/lib/contact-activity`. The distinction is meaningful and worth making explicit.

### IN-03: Spine migration files have deprecation banners but no DROP statements -- Slice 2 cleanup has no migration scaffold

**Files:** `supabase/migrations/20260407020000_spine_tables.sql:1`, `supabase/migrations/20260407021000_spine_interactions_trigger.sql:1`, `supabase/migrations/20260408001000_cleanup_spine_smoke_test_data.sql:1`

**Issue:** All three migrations are marked `DEPRECATED (Slice 1, 2026-04-22): spine tables superseded by activity_events. Will be dropped in Slice 2.` There is no corresponding Slice 2 migration placeholder or `BLOCKERS.md` entry to ensure the DROP actually happens. The deprecation comment is easy to miss in a future session.

**Fix:** Create a stub migration file for Slice 2 cleanup, even if it's empty, so the intent is tracked in version-controlled SQL:

```sql
-- supabase/migrations/20260501000000_slice2_drop_spine_tables.sql
-- Slice 2: drop deprecated spine tables.
-- TODO: DROP TABLE IF EXISTS public.spine_inbox CASCADE;
-- TODO: DROP TABLE IF EXISTS public.commitments CASCADE;
-- TODO: DROP TABLE IF EXISTS public.focus_queue CASCADE;
-- TODO: DROP TABLE IF EXISTS public.cycle_state CASCADE;
-- TODO: DROP TABLE IF EXISTS public.signals CASCADE;
-- TODO: DROP FUNCTION IF EXISTS public.spine_update_cycle_on_interaction();
-- TODO: DROP FUNCTION IF EXISTS public.spine_touch_updated_at();
```

Or add entries to `BLOCKERS.md` with a checklist, whichever matches the project's Slice 2 planning workflow.

---

_Reviewed: 2026-04-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
