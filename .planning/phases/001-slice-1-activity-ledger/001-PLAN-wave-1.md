---
phase: 001-slice-1-activity-ledger
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260422100000_activity_events.sql
  - src/lib/activity/types.ts
  - src/lib/activity/writeEvent.ts
  - src/lib/activity/queries.ts
  - SCHEMA.md
autonomous: false
requirements: [SLICE-1-T3, SLICE-1-T4, SLICE-1-T5, SLICE-1-T6, SLICE-1-T2]

must_haves:
  truths:
    - "activity_events table exists in Supabase with all 10 columns, 3 indexes, and RLS"
    - "writeEvent() accepts actorId, verb, object, context and writes a row via adminClient -- never throws"
    - "getContactTimeline() and getRecentActivity() return ActivityEvent[] from activity_events using the browser Supabase client"
    - "SCHEMA.md exists at repo root describing the layer map and all tables"
    - "ActivityVerb union type covers all 13 verbs from the spec"
  artifacts:
    - path: supabase/migrations/20260422100000_activity_events.sql
      provides: Idempotent DDL for activity_events table, indexes, and RLS
    - path: src/lib/activity/types.ts
      provides: ActivityVerb union type + ActivityEvent interface (DB shape)
    - path: src/lib/activity/writeEvent.ts
      provides: writeEvent() fire-and-forget helper using adminClient
    - path: src/lib/activity/queries.ts
      provides: getContactTimeline() and getRecentActivity() using browser Supabase client
    - path: SCHEMA.md
      provides: Architecture reference for all tables across all 8 slices
  key_links:
    - from: src/lib/activity/writeEvent.ts
      to: src/lib/supabase/admin.ts
      via: adminClient import
      pattern: "import.*adminClient.*admin"
    - from: src/lib/activity/queries.ts
      to: activity_events table
      via: supabase.from('activity_events')
      pattern: "from\\('activity_events'\\)"
---

<objective>
Lay the activity ledger foundation: schema, TypeScript contracts, write helper, and read queries.

Purpose: Every subsequent wave depends on these four files existing. Nothing can emit or read events until this wave ships and the migration is applied in Supabase.

Output: Migration SQL ready to paste, three lib files committed, SCHEMA.md at repo root.
</objective>

<execution_context>
@/Users/alex/crm/.claude/get-shit-done/workflows/execute-plan.md
@/Users/alex/crm/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/alex/crm/.planning/ROADMAP.md
@/Users/alex/crm/.planning/phases/001-slice-1-activity-ledger/001-CONTEXT.md

<interfaces>
<!-- adminClient pattern -- src/lib/supabase/admin.ts -->
```typescript
import { createClient } from "@supabase/supabase-js";
export const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

<!-- logError pattern -- src/lib/error-log.ts -->
```typescript
import { adminClient } from "@/lib/supabase/admin";
export async function logError(
  endpoint: string,
  error_message: string,
  context: Record<string, unknown>,
  error_code?: number,
): Promise<void>
// fire-and-forget: swallows its own errors
```

<!-- Naming collision note: src/lib/contact-activity.ts already exports an ActivityEvent
     as a DISPLAY type (id, source, sourceLabel, iconName, barColorClass, summary...).
     The new src/lib/activity/types.ts exports ActivityEvent as the DB ROW type.
     These are in different modules and do not conflict unless imported into the same file.
     Wave 3 (contact timeline) must import ActivityEvent only from src/lib/activity/types.ts. -->
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 0: [BLOCKING] Write migration file, create paste-file, open it</name>
  <files>
    supabase/migrations/20260422100000_activity_events.sql
    ~/Desktop/PASTE-INTO-SUPABASE-activity-events.sql
  </files>
  <read_first>
    - /Users/alex/crm/.planning/phases/001-slice-1-activity-ledger/001-CONTEXT.md (Task 3 -- full column/index/RLS spec)
    - /Users/alex/crm/supabase/migrations/20260422000000_campaign_enrollment_schedule.sql (syntax reference)
  </read_first>
  <action>
1. Write the migration file at `supabase/migrations/20260422100000_activity_events.sql` with this exact content:

    -- Slice 1: Universal activity ledger.
    -- Every user-observable action in GAT-BOS writes a row here.
    -- Idempotent: safe to run twice.

    CREATE TABLE IF NOT EXISTS public.activity_events (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       uuid NOT NULL,
      actor_id      uuid NOT NULL,
      verb          text NOT NULL,
      object_table  text NOT NULL,
      object_id     uuid NOT NULL,
      context       jsonb NOT NULL DEFAULT '{}'::jsonb,
      occurred_at   timestamptz NOT NULL DEFAULT now(),
      created_at    timestamptz NOT NULL DEFAULT now(),
      deleted_at    timestamptz NULL
    );

    CREATE INDEX IF NOT EXISTS idx_activity_events_user_occurred
      ON public.activity_events (user_id, occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_activity_events_object
      ON public.activity_events (object_table, object_id, occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_activity_events_actor
      ON public.activity_events (actor_id, occurred_at DESC);

    ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "owner_read_write" ON public.activity_events;
    CREATE POLICY "owner_read_write"
      ON public.activity_events
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());

2. Copy the same SQL verbatim to `~/Desktop/PASTE-INTO-SUPABASE-activity-events.sql`.

3. Run: `open ~/Desktop/PASTE-INTO-SUPABASE-activity-events.sql`

4. STOP. The migration must be pasted into the Supabase SQL Editor and executed by Alex before any code that reads or writes `activity_events` can be tested. Wave 2 and Wave 3 are blocked until Alex confirms the paste is done.
  </action>
  <verify>
    - File exists: `ls /Users/alex/crm/supabase/migrations/20260422100000_activity_events.sql`
    - Paste file exists: `ls ~/Desktop/PASTE-INTO-SUPABASE-activity-events.sql`
    - File opened in default viewer
  </verify>
  <how-to-verify>
    1. The paste file was auto-opened. Copy all its contents.
    2. Open Supabase SQL Editor for project rndnxhvibbqqjrzapdxs.
    3. Paste and click Run.
    4. Confirm: "Success. No rows returned." (DDL success message).
    5. Verify: run `SELECT COUNT(*) FROM activity_events;` -- returns 0 with no error.
  </how-to-verify>
  <resume-signal>Type "migration done" after the Supabase SQL Editor confirms success.</resume-signal>
  <done>
    - supabase/migrations/20260422100000_activity_events.sql committed
    - ~/Desktop/PASTE-INTO-SUPABASE-activity-events.sql opened
    - Alex has confirmed migration applied in Supabase (typed "migration done")
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 1: Write SCHEMA.md and activity lib module (types + writeEvent + queries)</name>
  <files>
    SCHEMA.md
    src/lib/activity/types.ts
    src/lib/activity/writeEvent.ts
    src/lib/activity/queries.ts
  </files>
  <read_first>
    - /Users/alex/crm/.planning/phases/001-slice-1-activity-ledger/001-CONTEXT.md (Tasks 2, 4, 5, 6 -- exact specs)
    - /Users/alex/crm/src/lib/supabase/admin.ts (adminClient pattern)
    - /Users/alex/crm/src/lib/error-log.ts (logError pattern)
    - /Users/alex/crm/src/lib/supabase/client.ts (browser client -- needed for queries.ts)
  </read_first>
  <behavior>
    - ActivityVerb: union type of exactly 13 strings: 'capture.created' | 'capture.transcribed' | 'capture.classified' | 'capture.promoted' | 'ticket.status_changed' | 'email.sent' | 'message.sent' | 'message.drafted' | 'project.updated' | 'event.created' | 'campaign.step_fired' | 'ai.call' | 'interaction.backfilled'
    - ActivityEvent DB interface: matches all 10 migration columns exactly (id, user_id, actor_id, verb, object_table, object_id, context, occurred_at, created_at, deleted_at)
    - writeEvent: given valid args, inserts one row to activity_events using adminClient and returns void; given a DB error, calls logError and returns void without throwing
    - getContactTimeline: given a contactId, returns rows where object_id = contactId OR context->>'contact_id' = contactId, ordered occurred_at DESC, limit 50
    - getRecentActivity: returns all rows ordered occurred_at DESC, limit 100
  </behavior>
  <action>
**A. Write /Users/alex/crm/SCHEMA.md**

Content: repo-root architecture reference. Sections:

1. "## Layer Map" -- three tiers with 1-2 sentence descriptions:
   - Raw data: Supabase tables, RLS-enforced, source of truth
   - App: Next.js App Router API routes and Server Actions, single boundary for writes
   - Client: React components, read-only through Supabase browser client with RLS

2. "## Entity Classification" -- markdown table: name | layer | status | notes.
   Include every known table. Key status values:
   - activity_events: Raw | live (Slice 1 canonical ledger) | canonical write target from Slice 1
   - contacts, interactions, notes, tasks, follow_ups, material_requests, material_request_items, design_assets: Raw | live | --
   - events, projects, project_touchpoints: Raw | live | --
   - email_drafts, emails: Raw | live | --
   - captures, campaign_enrollments, campaigns, campaign_steps: Raw | live | --
   - error_logs: Raw | live | internal only
   - spine_inbox, commitments, signals, focus_queue, cycle_state: Raw | live (deprecated Slice 2) | do not extend

3. "## Restructure Slice Plan" -- table: slice | summary.
   Slice 1 = Activity ledger foundation. Slices 2-8 = [To be planned].

4. "## activity_events Column Reference" -- markdown table of all 10 columns from the migration: name | type | nullable | default | purpose.

Keep file under 120 lines.

**B. Write /Users/alex/crm/src/lib/activity/types.ts**

Exact content:

    // src/lib/activity/types.ts
    // Canonical type contracts for the activity_events ledger.
    // Slice 1 -- 2026-04-22.

    export type ActivityVerb =
      | 'capture.created'
      | 'capture.transcribed'
      | 'capture.classified'
      | 'capture.promoted'
      | 'ticket.status_changed'
      | 'email.sent'
      | 'message.sent'
      | 'message.drafted'
      | 'project.updated'
      | 'event.created'
      | 'campaign.step_fired'
      | 'ai.call'
      | 'interaction.backfilled';

    export interface ActivityEvent {
      id: string;
      user_id: string;
      actor_id: string;
      verb: ActivityVerb;
      object_table: string;
      object_id: string;
      context: Record<string, unknown>;
      occurred_at: string;
      created_at: string;
      deleted_at: string | null;
    }

**C. Write /Users/alex/crm/src/lib/activity/writeEvent.ts**

Exact content:

    // src/lib/activity/writeEvent.ts
    // Fire-and-forget helper for writing to the activity_events ledger.
    // Uses service-role adminClient -- bypasses RLS.
    // Safe for Server Actions and API routes. Never call from browser components.
    // Never throws. On error, logs via logError and returns void.
    // Slice 1 -- 2026-04-22.

    import { adminClient } from '@/lib/supabase/admin';
    import { logError } from '@/lib/error-log';
    import type { ActivityVerb } from './types';

    const OWNER_USER_ID = process.env.OWNER_USER_ID ?? '';

    interface WriteEventInput {
      actorId: string;
      verb: ActivityVerb;
      object: { table: string; id: string };
      context?: Record<string, unknown>;
    }

    export async function writeEvent(input: WriteEventInput): Promise<void> {
      const { actorId, verb, object, context = {} } = input;
      const { error } = await adminClient
        .from('activity_events')
        .insert({
          user_id: OWNER_USER_ID,
          actor_id: actorId,
          verb,
          object_table: object.table,
          object_id: object.id,
          context,
        });

      if (error) {
        await logError('activity/writeEvent', error.message, {
          verb,
          object_table: object.table,
          object_id: object.id,
        });
      }
    }

**D. Write /Users/alex/crm/src/lib/activity/queries.ts**

Uses the BROWSER Supabase client (createClient from @/lib/supabase/client), NOT adminClient. RLS enforces user scoping at the DB level.

Exact content:

    // src/lib/activity/queries.ts
    // Read queries for the activity_events ledger.
    // Uses the browser-side Supabase client -- RLS scopes results to auth.uid().
    // Slice 1 -- 2026-04-22.

    import { createClient } from '@/lib/supabase/client';
    import type { ActivityEvent } from './types';

    export async function getContactTimeline(
      contactId: string,
      limit = 50
    ): Promise<ActivityEvent[]> {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('activity_events')
        .select('*')
        .or(`object_id.eq.${contactId},context->>contact_id.eq.${contactId}`)
        .order('occurred_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[activity/queries] getContactTimeline error:', error.message);
        return [];
      }
      return (data ?? []) as ActivityEvent[];
    }

    export async function getRecentActivity(limit = 100): Promise<ActivityEvent[]> {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('activity_events')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[activity/queries] getRecentActivity error:', error.message);
        return [];
      }
      return (data ?? []) as ActivityEvent[];
    }
  </action>
  <verify>
    <automated>cd /Users/alex/crm && pnpm typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm typecheck` exits 0 (no TypeScript errors)
    - `grep -r "ActivityVerb\|ActivityEvent" /Users/alex/crm/src/lib/activity/` returns hits in all 3 files
    - `grep "interaction.backfilled" /Users/alex/crm/src/lib/activity/types.ts` returns a match
    - `grep "OWNER_USER_ID" /Users/alex/crm/src/lib/activity/writeEvent.ts` returns a match
    - `grep "contact_id" /Users/alex/crm/src/lib/activity/queries.ts` returns a match (the OR filter)
    - `ls /Users/alex/crm/SCHEMA.md` returns the file
    - `wc -l /Users/alex/crm/SCHEMA.md` is no greater than 120
    - `grep "activity_events" /Users/alex/crm/SCHEMA.md` returns at least one match
    - `grep "spine_inbox" /Users/alex/crm/SCHEMA.md` output contains the word "deprecated"
  </acceptance_criteria>
  <done>
    SCHEMA.md exists at repo root under 120 lines. Three files exist under src/lib/activity/. pnpm typecheck passes. All acceptance criteria green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| API route / Server Action -> activity_events | writeEvent uses adminClient (service-role). Only server-side code can call it. Never exposed to the browser. |
| Browser client -> activity_events (reads) | RLS enforces user_id = auth.uid(). Browser can only read its own rows. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-001-01 | Spoofing | writeEvent OWNER_USER_ID | accept | Single-tenant app; env var is controlled by Vercel project owner only. |
| T-001-02 | Tampering | activity_events via browser | mitigate | RLS policy "owner_read_write" blocks writes from browser clients. writeEvent uses service-role and is server-only. |
| T-001-03 | Information Disclosure | getContactTimeline / getRecentActivity | mitigate | Both functions use the browser Supabase client -- RLS scopes all SELECT results to auth.uid(). |
| T-001-04 | Denial of Service | writeEvent on every write path | accept | logError swallows its own failures; callers are never blocked. Volume is bounded by single-tenant usage. |
</threat_model>

<verification>
After Task 0 (migration paste confirmed by Alex) and Task 1:

    cd /Users/alex/crm && pnpm typecheck && pnpm build

Both must pass before Wave 2 starts. Do NOT proceed to Wave 2 if typecheck fails.

Also confirm the migration applied:
- Supabase Table Editor shows `activity_events` with 10 columns.
- SQL Editor: `SELECT COUNT(*) FROM activity_events;` returns 0 (empty, not missing).
</verification>

<success_criteria>
- supabase/migrations/20260422100000_activity_events.sql committed
- activity_events table live in Supabase (Alex confirmed "migration done")
- src/lib/activity/types.ts, writeEvent.ts, queries.ts all committed
- SCHEMA.md committed at repo root
- pnpm typecheck passes
- pnpm build passes
</success_criteria>

<output>
After completion, create `/Users/alex/crm/.planning/phases/001-slice-1-activity-ledger/001-01-SUMMARY.md`
</output>
