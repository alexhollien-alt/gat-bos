---
phase: 001-slice-1-activity-ledger
plan: 02
type: execute
wave: 2
depends_on: [001-PLAN-wave-1]
files_modified:
  - src/lib/captures/promote.ts
  - src/app/api/email/approve-and-send/route.ts
  - src/app/api/projects/[id]/route.ts
  - src/app/api/calendar/create/route.ts
  - src/app/(app)/tickets/[id]/page.tsx
  - src/app/(app)/tickets/[id]/actions.ts
autonomous: true
requirements: [SLICE-1-T7]

must_haves:
  truths:
    - "Every successful capture promote emits a capture.promoted event to activity_events"
    - "Every successful email send (send_now action) emits an email.sent event to activity_events"
    - "Every successful project PATCH emits a project.updated event to activity_events"
    - "Every successful calendar event creation emits an event.created event to activity_events"
    - "Every ticket status change emits a ticket.status_changed event with from_status and to_status in context"
    - "No write path throws or blocks if writeEvent fails -- fire-and-forget everywhere"
  artifacts:
    - path: src/lib/captures/promote.ts
      provides: writeEvent call after successful promote
    - path: src/app/api/email/approve-and-send/route.ts
      provides: writeEvent call after send_now succeeds
    - path: src/app/api/projects/[id]/route.ts
      provides: writeEvent call after PATCH succeeds
    - path: src/app/api/calendar/create/route.ts
      provides: writeEvent call after local event row inserted
    - path: src/app/(app)/tickets/[id]/actions.ts
      provides: Server Action wrapping ticket status change + writeEvent
    - path: src/app/(app)/tickets/[id]/page.tsx
      provides: handleStatusChange calling the new Server Action instead of direct supabase.update
  key_links:
    - from: src/lib/captures/promote.ts
      to: src/lib/activity/writeEvent.ts
      via: writeEvent import
      pattern: "writeEvent"
    - from: src/app/(app)/tickets/[id]/page.tsx
      to: src/app/(app)/tickets/[id]/actions.ts
      via: Server Action import
      pattern: "updateTicketStatus"
---

<objective>
Retrofit the five highest-traffic write paths to emit activity events after each successful write.

Purpose: Once the ledger exists (Wave 1), every meaningful action must write to it. These five paths cover the majority of Alex's daily operations: capture processing, email sending, project updates, calendar creates, and ticket status changes.

Output: Five source files modified. One new server action file created. All writes are fire-and-forget -- no caller is blocked if the ledger write fails.
</objective>

<execution_context>
@/Users/alex/crm/.claude/get-shit-done/workflows/execute-plan.md
@/Users/alex/crm/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/alex/crm/.planning/ROADMAP.md
@/Users/alex/crm/.planning/phases/001-slice-1-activity-ledger/001-CONTEXT.md
@/Users/alex/crm/.planning/phases/001-slice-1-activity-ledger/001-01-SUMMARY.md

<interfaces>
<!-- writeEvent signature -- src/lib/activity/writeEvent.ts (created in Wave 1) -->

    import { writeEvent } from '@/lib/activity/writeEvent';

    // Signature:
    // writeEvent({ actorId, verb, object: { table, id }, context? }): Promise<void>
    // actorId: use process.env.OWNER_USER_ID ?? ''
    // verb: one of the ActivityVerb union members
    // object.table: the Supabase table name as a string
    // object.id: the UUID of the affected row
    // context: optional extra data (e.g. { from_status, to_status })
    // Never throws. Returns void. Call with void writeEvent(...) for fire-and-forget.

<!-- Key insight: ticket status change is CLIENT-SIDE (src/app/(app)/tickets/[id]/page.tsx).
     writeEvent is server-only (uses adminClient). So a Server Action wrapper is required.
     Create src/app/(app)/tickets/[id]/actions.ts with 'use server' directive.
     The page calls the Server Action instead of supabase.update() directly. -->

<!-- Fire-and-forget pattern (match existing codebase style): -->

    // After a successful write, add:
    void writeEvent({
      actorId: process.env.OWNER_USER_ID ?? '',
      verb: 'some.verb',
      object: { table: 'table_name', id: rowId },
      context: { optional: 'fields' },
    });
    // Do NOT await writeEvent -- this is intentionally fire-and-forget.
    // The void keyword suppresses the floating Promise lint warning.

<!-- contact_id in context -- required for getContactTimeline visibility:
     getContactTimeline filters by: object_id = contactId OR context->>'contact_id' = contactId
     Without contact_id in context, events on non-contact tables (captures, material_requests)
     will be invisible in per-contact timeline views.

     contact_id strategy by path:
     - capture.promoted: capture row has parsed_contact_id -- include if set.
     - ticket.status_changed: fetch contact_id from material_requests before writing event.
     - email.sent: requires email_draft -> contact join (complex). Defer -- see comment in code.
     - project.updated: contact_id not reliably available. Defer -- see comment in code.
     - event.created: not contact-specific. Defer -- see comment in code.

     For the three deferred paths, add a code comment explaining why contact_id is absent
     and flagging it as a Slice 2 improvement. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Retrofit capture promote, email send, project PATCH, and calendar create</name>
  <files>
    src/lib/captures/promote.ts
    src/app/api/email/approve-and-send/route.ts
    src/app/api/projects/[id]/route.ts
    src/app/api/calendar/create/route.ts
  </files>
  <read_first>
    - /Users/alex/crm/src/lib/captures/promote.ts (full file -- know the return points and Capture type fields)
    - /Users/alex/crm/src/app/api/email/approve-and-send/route.ts (find the send_now success branch)
    - /Users/alex/crm/src/app/api/projects/[id]/route.ts (find the PATCH success branch)
    - /Users/alex/crm/src/app/api/calendar/create/route.ts (find the local row insert success)
    - /Users/alex/crm/src/lib/activity/writeEvent.ts (confirm the import path is correct)
  </read_first>
  <action>
Add `void writeEvent(...)` calls immediately after each successful downstream write. Do NOT await. Add `import { writeEvent } from '@/lib/activity/writeEvent';` to each file's import block.

**src/lib/captures/promote.ts** -- three success branches, each returns a PromoteSuccess.

Check whether the Capture type includes a `parsed_contact_id` field (read the type/interface). If it does, include `contact_id: capture.parsed_contact_id` in context when it is truthy. If the field is named differently (e.g. `contact_id`), use that field name instead. If no such field exists, omit contact_id and add a comment: `// contact_id not on Capture row -- Slice 2 improvement`.

After the `interactions` insert succeeds (the `return { ok: true, promotedTo: 'interaction', ... }` block), add before the return:

    void writeEvent({
      actorId: process.env.OWNER_USER_ID ?? '',
      verb: 'capture.promoted',
      object: { table: 'captures', id: capture.id },
      context: {
        promoted_to: 'interaction',
        promoted_id: data.id,
        // Include contact_id so getContactTimeline can index this event per contact.
        ...(capture.parsed_contact_id ? { contact_id: capture.parsed_contact_id } : {}),
      },
    });

After the `follow_ups` insert succeeds (the `return { ok: true, promotedTo: 'follow_up', ... }` block), add before the return:

    void writeEvent({
      actorId: process.env.OWNER_USER_ID ?? '',
      verb: 'capture.promoted',
      object: { table: 'captures', id: capture.id },
      context: {
        promoted_to: 'follow_up',
        promoted_id: data.id,
        ...(capture.parsed_contact_id ? { contact_id: capture.parsed_contact_id } : {}),
      },
    });

After the `material_requests` insert succeeds (the `return { ok: true, promotedTo: 'ticket', ... }` block), add before the return:

    void writeEvent({
      actorId: process.env.OWNER_USER_ID ?? '',
      verb: 'capture.promoted',
      object: { table: 'captures', id: capture.id },
      context: {
        promoted_to: 'ticket',
        promoted_id: data.id,
        ...(capture.parsed_contact_id ? { contact_id: capture.parsed_contact_id } : {}),
      },
    });

Note: `capture.id` is available as `capture.id` since `capture` is in scope throughout `promoteCapture`. If the Capture type uses a different field name for the contact reference (e.g. `contact_id` directly), use that instead and adjust the spread condition accordingly.

**src/app/api/email/approve-and-send/route.ts** -- find the `send_now` action branch.

Locate the block that handles `action === 'send_now'` and returns a successful response after `sendDraft()` resolves. After the Resend send succeeds (look for where `fireMarkRead` is called), add:

    // contact_id not available here without a join from email_draft -> email -> contact.
    // Slice 2 improvement: fetch contact_id and include in context for timeline indexing.
    void writeEvent({
      actorId: process.env.OWNER_USER_ID ?? '',
      verb: 'email.sent',
      object: { table: 'email_drafts', id: draftId },
      context: { email_id: draft.email_id },
    });

The `draftId` variable is in scope (extracted from `body.draft_id` at the top of POST). `draft.email_id` is on the DraftRow type.

**src/app/api/projects/[id]/route.ts** -- find the PATCH handler success branch.

In the PATCH handler, after `adminClient.from('projects').update(...).select().single()` returns data successfully and before `return NextResponse.json(data)`, add:

    // contact_id not reliably available on project PATCH without additional context.
    // Slice 2 improvement: include contact_id in context for per-contact timeline indexing.
    void writeEvent({
      actorId: process.env.OWNER_USER_ID ?? '',
      verb: 'project.updated',
      object: { table: 'projects', id: id },
      context: { updated_fields: Object.keys(sanitized) },
    });

The `id` variable is extracted from `params` at the top of the PATCH handler.

**src/app/api/calendar/create/route.ts** -- find the local row insert success branch.

After Step 1 (the local insert into `events`) succeeds -- `localRow` is populated -- and BEFORE Step 2 (the gcal insertEvent call), add:

    // event.created is not contact-specific. contact_id not included.
    // Slice 2 improvement if calendar events ever need per-contact timeline indexing.
    void writeEvent({
      actorId: process.env.OWNER_USER_ID ?? '',
      verb: 'event.created',
      object: { table: 'events', id: localRow.id },
      context: { title },
    });

Placing this before Step 2 ensures the activity event is emitted even if gcal fails.
  </action>
  <verify>
    <automated>cd /Users/alex/crm && pnpm typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm typecheck` exits 0
    - `grep "writeEvent" /Users/alex/crm/src/lib/captures/promote.ts` returns 4 matches (1 import + 3 void calls)
    - `grep "writeEvent" /Users/alex/crm/src/app/api/email/approve-and-send/route.ts` returns 2 matches (1 import + 1 void call)
    - `grep "writeEvent" /Users/alex/crm/src/app/api/projects/[id]/route.ts` returns 2 matches (1 import + 1 void call)
    - `grep "writeEvent" /Users/alex/crm/src/app/api/calendar/create/route.ts` returns 2 matches (1 import + 1 void call)
    - `grep "void writeEvent" /Users/alex/crm/src/lib/captures/promote.ts` returns 3 matches (all fire-and-forget, none awaited)
    - `grep "contact_id" /Users/alex/crm/src/lib/captures/promote.ts` returns at least 3 matches (one per promote branch)
  </acceptance_criteria>
  <done>
    Four files modified. writeEvent fires after each successful write in all four paths. capture.promoted includes contact_id from parsed_contact_id. The other three paths document why contact_id is absent (Slice 2 improvement). pnpm typecheck passes.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create ticket Server Action and update page to call it</name>
  <files>
    src/app/(app)/tickets/[id]/actions.ts
    src/app/(app)/tickets/[id]/page.tsx
  </files>
  <read_first>
    - /Users/alex/crm/src/app/(app)/tickets/[id]/page.tsx (full file -- know handleStatusChange at line 68-79)
    - /Users/alex/crm/src/lib/activity/writeEvent.ts (confirm import path)
    - /Users/alex/crm/src/lib/supabase/admin.ts (adminClient -- Server Action uses this, not browser client)
  </read_first>
  <action>
The ticket page is a "use client" component. `writeEvent` uses `adminClient` (service-role) and must NOT be called from browser code. The fix is a Server Action.

**A. Create /Users/alex/crm/src/app/(app)/tickets/[id]/actions.ts**

Exact content:

    'use server';

    // src/app/(app)/tickets/[id]/actions.ts
    // Server Action for ticket status mutation + activity ledger write.
    // Replaces the direct supabase.update() call in the client page.
    // Slice 1 -- 2026-04-22.

    import { adminClient } from '@/lib/supabase/admin';
    import { writeEvent } from '@/lib/activity/writeEvent';
    import type { MaterialRequestStatus } from '@/lib/types';

    const OWNER_USER_ID = process.env.OWNER_USER_ID ?? '';

    export async function updateTicketStatus(
      ticketId: string,
      fromStatus: MaterialRequestStatus,
      toStatus: MaterialRequestStatus,
    ): Promise<{ ok: boolean; error?: string }> {
      const updates: Record<string, unknown> = {
        status: toStatus,
        updated_at: new Date().toISOString(),
      };
      if (toStatus === 'submitted') updates.submitted_at = new Date().toISOString();
      if (toStatus === 'complete') updates.completed_at = new Date().toISOString();

      // Fetch contact_id so this event appears in the per-contact timeline.
      // getContactTimeline filters by object_id OR context->>'contact_id'.
      const { data: ticketRow } = await adminClient
        .from('material_requests')
        .select('contact_id')
        .eq('id', ticketId)
        .maybeSingle();

      const { error } = await adminClient
        .from('material_requests')
        .update(updates)
        .eq('id', ticketId);

      if (error) {
        return { ok: false, error: error.message };
      }

      void writeEvent({
        actorId: OWNER_USER_ID,
        verb: 'ticket.status_changed',
        object: { table: 'material_requests', id: ticketId },
        context: {
          from_status: fromStatus,
          to_status: toStatus,
          // contact_id enables getContactTimeline to surface this event per contact.
          ...(ticketRow?.contact_id ? { contact_id: ticketRow.contact_id } : {}),
        },
      });

      return { ok: true };
    }

**B. Update /Users/alex/crm/src/app/(app)/tickets/[id]/page.tsx**

At the top of the file, add the import for the Server Action:

    import { updateTicketStatus } from './actions';

Replace the `handleStatusChange` function body (currently lines 68-79 -- the direct `await supabase.from('material_requests').update(updates).eq('id', ticket.id)` call) with a call to the Server Action:

    const handleStatusChange = async (newStatus: MaterialRequestStatus) => {
      if (!ticket) return;
      const result = await updateTicketStatus(ticket.id, ticket.status, newStatus);
      if (result.ok) {
        setTicket({ ...ticket, status: newStatus });
      }
    };

Remove the `updates` object construction and the direct `supabase.from('material_requests').update` call that was inside `handleStatusChange`. The Server Action owns that logic now.

Do NOT remove the `supabase` client or `fetchTicket` -- those are still used for the initial data load and notes save.
  </action>
  <verify>
    <automated>cd /Users/alex/crm && pnpm typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm typecheck` exits 0
    - `ls /Users/alex/crm/src/app/(app)/tickets/[id]/actions.ts` returns the file
    - `grep "'use server'" /Users/alex/crm/src/app/(app)/tickets/[id]/actions.ts` returns a match
    - `grep "updateTicketStatus" /Users/alex/crm/src/app/(app)/tickets/[id]/page.tsx` returns at least 2 matches (import + call)
    - `grep "ticket.status_changed" /Users/alex/crm/src/app/(app)/tickets/[id]/actions.ts` returns a match
    - `grep "from_status" /Users/alex/crm/src/app/(app)/tickets/[id]/actions.ts` returns a match (context field)
    - `grep "contact_id" /Users/alex/crm/src/app/(app)/tickets/[id]/actions.ts` returns at least 2 matches (fetch + context spread)
    - Page no longer calls `supabase.from('material_requests').update` inside handleStatusChange: `grep "material_requests.*update" /Users/alex/crm/src/app/(app)/tickets/[id]/page.tsx` returns 0 matches inside the handleStatusChange function (only in handleSaveNotes or other locations is acceptable)
  </acceptance_criteria>
  <done>
    actions.ts created with 'use server'. Fetches contact_id from material_requests before update and includes it in writeEvent context. page.tsx handleStatusChange delegates to updateTicketStatus Server Action. pnpm typecheck passes.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client component -> Server Action (ticket) | updateTicketStatus runs server-side only. Browser cannot call writeEvent directly. |
| API routes -> writeEvent | All four API routes are server-side. writeEvent call is fire-and-forget and does not affect response. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-001-05 | Tampering | updateTicketStatus Server Action | accept | Single-tenant; only Alex uses the app. No user-supplied ticketId trust boundary issue. |
| T-001-06 | Denial of Service | void writeEvent on all 5 paths | accept | Fire-and-forget. logError swallows failures. No caller is blocked. |
| T-001-07 | Repudiation | activity_events as audit trail | mitigate | writeEvent records verb + object + context on every action. Provides a durable log. |
</threat_model>

<verification>
After both tasks:

    cd /Users/alex/crm && pnpm typecheck && pnpm build

Both must pass. Check:
- `grep -r "void writeEvent" /Users/alex/crm/src/` returns exactly 7 call sites (3 in promote.ts, 1 in approve-and-send, 1 in projects route, 1 in calendar create, 1 in actions.ts)
- No `await writeEvent` anywhere (all must be void-prefixed fire-and-forget)
- `grep "contact_id" /Users/alex/crm/src/lib/captures/promote.ts` returns matches in all 3 promote branches
- `grep "contact_id" /Users/alex/crm/src/app/(app)/tickets/[id]/actions.ts` returns matches (fetch + context spread)
</verification>

<success_criteria>
- Five write paths emit activity events
- capture.promoted includes contact_id from parsed_contact_id when available
- ticket.status_changed fetches and includes contact_id from material_requests
- email.sent, project.updated, event.created document why contact_id is absent (Slice 2 improvement)
- Ticket status change goes through Server Action (not direct browser supabase call)
- pnpm typecheck passes
- pnpm build passes
- No write path is blocked by a failing writeEvent call
</success_criteria>

<output>
After completion, create `/Users/alex/crm/.planning/phases/001-slice-1-activity-ledger/001-02-SUMMARY.md`
</output>
