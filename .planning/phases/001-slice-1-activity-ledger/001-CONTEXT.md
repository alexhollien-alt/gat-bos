# Phase 001: Slice 1 Activity Ledger Foundation - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Source:** PRD Express Path (gat-bos-restructure-plan-v3 Slice 1 spec)

<domain>
## Phase Boundary

Create the universal activity ledger (`activity_events` table) as the canonical write path for every user-observable action in GAT-BOS. Retrofit five highest-traffic write paths to emit events. Backfill one week of prior interactions. Update the contact detail page to read its timeline from the ledger (replacing the current five-table union). Deprecate spine files with comments -- do not delete them.

This is a PLUMBING session. No new UI surfaces. No new user-facing routes. No scope outside the 11 enumerated tasks.

</domain>

<decisions>
## Implementation Decisions

### Task 1 -- Git Tag
- Tag `pre-restructure-2026-04-22` already exists on main. SKIP.

### Task 2 -- SCHEMA.md
- Write SCHEMA.md at repo root.
- Contents: layer map, entity classification, current-to-target table plan for all tables across all 8 restructure slices.

### Task 3 -- activity_events Migration
- Table: `activity_events`
- Columns:
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid not null`
  - `actor_id uuid not null`
  - `verb text not null`
  - `object_table text not null`
  - `object_id uuid not null`
  - `context jsonb default '{}'::jsonb`
  - `occurred_at timestamptz not null default now()`
  - `created_at timestamptz not null default now()`
  - `deleted_at timestamptz null`
- Indexes:
  - `(user_id, occurred_at desc)`
  - `(object_table, object_id, occurred_at desc)`
  - `(actor_id, occurred_at desc)`
- RLS: owner read/write by `user_id = auth.uid()`. Service-role bypass for crons.
- Migration filename: `supabase/migrations/20260422100000_activity_events.sql`
- Idempotent: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`

### Task 4 -- src/lib/activity/types.ts
- Verb enum (union type, not TS enum, for forward compatibility):
  - `capture.created`, `capture.transcribed`, `capture.classified`, `capture.promoted`
  - `ticket.status_changed`
  - `email.sent`, `message.sent`, `message.drafted`
  - `project.updated`
  - `event.created`
  - `campaign.step_fired`
  - `ai.call`
  - `interaction.backfilled` (for backfill script)
- Export `ActivityVerb` type.
- Export `ActivityEvent` interface matching the DB columns.

### Task 5 -- src/lib/activity/writeEvent.ts
- Function signature: `writeEvent({ actorId, verb, object: { table, id }, context? }): Promise<void>`
- Uses service-role admin client (bypasses RLS -- cron and server actions both call this).
- `user_id` derived from `OWNER_USER_ID` env var (current single-tenant pattern).
- Fails closed: on error, logs via `logError('activity', ...)` and returns without throwing (never blocks the caller).
- No return value; caller does not depend on success.

### Task 6 -- src/lib/activity/queries.ts
- `getContactTimeline(contactId: string, limit = 50): Promise<ActivityEvent[]>`
  - Filters: `object_table = 'contacts' AND object_id = contactId` OR (join via context.contact_id if needed)
  - Actually: filter `object_id = contactId OR context->>'contact_id' = contactId` to catch both direct and contextual events.
  - Ordered: `occurred_at DESC`.
  - Scoped by `auth.uid()` (browser Supabase client, RLS enforces).
- `getRecentActivity(limit = 100): Promise<ActivityEvent[]>`
  - No object filter, all verbs, ordered `occurred_at DESC`.
  - Scoped by `auth.uid()`.

### Task 7 -- Retrofit Five Write Paths
Paths to retrofit (emit writeEvent after successful write):
1. **Capture promote** -- `src/lib/captures/promote.ts` -- verb: `capture.promoted`, object: captures row
2. **Ticket status change** -- find the ticket status mutation (likely `src/app/(app)/tickets/[id]/actions.ts` or similar) -- verb: `ticket.status_changed`, context: `{ from_status, to_status }`
3. **Email draft send** -- `src/app/api/email/approve-and-send/route.ts` -- verb: `email.sent`, object: email_drafts row
4. **Project update** -- `src/app/(app)/projects/[id]/actions.ts` or `src/app/api/projects/` -- verb: `project.updated`
5. **Event create** -- `src/app/api/events/` or `src/lib/events/` -- verb: `event.created`

All: fire-and-forget (do not await in a way that blocks the caller; use void or best-effort Promise).

### Task 8 -- Contact Detail Page Timeline
- File: `src/app/(app)/contacts/[id]/page.tsx` or the corresponding client component.
- Replace the current five-table union query with `getContactTimeline(contactId)`.
- Render the activity feed using the same visual treatment currently in place.
- No new UI components required.

### Task 9 -- Backfill Script
- File: `scripts/backfill-activity-events.ts`
- Idempotent: check for existing `interaction.backfilled` events with same `object_id` before inserting.
- Scope: `interactions` rows from last 7 days (`created_at >= now() - interval '7 days'`).
- Verb: `interaction.backfilled`.
- Run via: `npx ts-node scripts/backfill-activity-events.ts` or as a one-time script.

### Task 10 -- Spine Deprecation Comments
- Add deprecation comment at top of every `src/lib/spine/*.ts` file and the original spine migration SQL.
- Comment format: `// DEPRECATED (Slice 1, 2026-04-22): spine is superseded by activity_events. Do not extend. Will be deleted in Slice 2.`
- Read-only change: no logic modifications.

### Task 11 -- CLAUDE.md Note
- Add one paragraph to `~/crm/CLAUDE.md` noting that `activity_events` is canonical and spine is deprecated.
- Add to the ## Build and Dev section or a new ## Architecture Notes section.

### Claude's Discretion
- Exact SQL syntax for idempotent migration (IF NOT EXISTS vs explicit checks).
- Whether to use `adminClient` or `createClient` with service_role for writeEvent.
- Exact contact timeline join strategy (direct object_id vs context.contact_id -- both are acceptable).
- Commit message wording (must be atomic per task).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth and admin clients
- `src/lib/supabase/admin.ts` -- adminClient pattern (service-role bypass)
- `src/lib/supabase/server.ts` -- server-side user-scoped client

### Error logging pattern
- `src/lib/error-log.ts` -- logError() pattern used by writeEvent

### Existing write paths to retrofit
- `src/lib/captures/promote.ts` -- capture promote (already has logError pattern)
- `src/app/api/email/approve-and-send/route.ts` -- email send
- `src/app/api/events/` -- event create (new, from last session)

### Contact detail page (timeline replacement)
- `src/app/(app)/contacts/[id]/` -- find the timeline/feed component here

### Existing migrations (pattern reference)
- `supabase/migrations/` -- any recent migration for syntax reference

</canonical_refs>

<specifics>
## Specific Requirements

- **Tables touched:** ONLY `activity_events` (new). `interactions` stays read-only.
- **No deletions:** Spine files get comments, not deletions.
- **No new routes:** No `/api/activity` or similar. writeEvent is an internal helper only.
- **No UI:** No new components. Contact timeline replacement uses existing markup.
- **Idempotent migration:** Must be safe to run twice.
- **SCHEMA.md:** Write at repo root `/Users/alex/crm/SCHEMA.md`.
- **Global out-of-scope:** Twilio/SMS, Zapier/Make.com, Mailerlite revival, phone/SMS flow, GAT co-brand in digital, scraping, hard deletes without soak, em dashes in user-facing copy.

</specifics>

<deferred>
## Deferred

- Dropping spine tables (Slice 2).
- Dropping `interactions` table (Slice 2B).
- Any new API routes for activity_events.
- Voice/mic capture (BLOCKERS.md).
- Inline contact picker for captures (BLOCKERS.md).
- Claude API intent parser upgrade (BLOCKERS.md).
- Capture editing (BLOCKERS.md).
- Campaign row creation (BLOCKERS.md).

</deferred>

---

*Phase: 001-slice-1-activity-ledger*
*Context gathered: 2026-04-22 via PRD Express Path (restructure spec)*
