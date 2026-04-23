---
phase: 001-slice-1-activity-ledger
plan: 03
type: execute
wave: 3
depends_on: [001-PLAN-wave-1, 001-PLAN-wave-2]
files_modified:
  - src/app/(app)/contacts/[id]/page.tsx
  - scripts/backfill-activity-events.mjs
  - src/lib/spine/parser.ts
  - src/lib/spine/queries.ts
  - src/lib/spine/types.ts
  - supabase/migrations/20260407020000_spine_tables.sql
  - supabase/migrations/20260407021000_spine_interactions_trigger.sql
  - supabase/migrations/20260408001000_cleanup_spine_smoke_test_data.sql
  - CLAUDE.md
autonomous: true
requirements: [SLICE-1-T8, SLICE-1-T9, SLICE-1-T10, SLICE-1-T11]

must_haves:
  truths:
    - "Contact detail page Activity Feed section reads from getContactTimeline() with fallback to buildActivityFeed() when the ledger has no rows for that contact"
    - "Activity feed renders correctly for a contact that has activity_events rows (requires migration from Wave 1 to be live)"
    - "Backfill script exists and is idempotent -- running it twice does not produce duplicate rows"
    - "All three src/lib/spine/*.ts files have a deprecation comment at the top"
    - "All three spine migration SQL files have a deprecation comment at the top"
    - "CLAUDE.md has an Architecture Notes section referencing activity_events as canonical and spine as deprecated"
  artifacts:
    - path: src/app/(app)/contacts/[id]/page.tsx
      provides: Activity Feed reads from getContactTimeline (not buildActivityFeed)
      contains: "getContactTimeline"
    - path: scripts/backfill-activity-events.mjs
      provides: One-time idempotent backfill of interactions rows into activity_events
    - path: src/lib/spine/parser.ts
      provides: Deprecation comment at top
    - path: src/lib/spine/queries.ts
      provides: Deprecation comment at top
    - path: src/lib/spine/types.ts
      provides: Deprecation comment at top
    - path: CLAUDE.md
      provides: Architecture Notes section with activity_events / spine guidance
  key_links:
    - from: src/app/(app)/contacts/[id]/page.tsx
      to: src/lib/activity/queries.ts
      via: getContactTimeline import
      pattern: "getContactTimeline"
    - from: scripts/backfill-activity-events.mjs
      to: activity_events table
      via: adminClient.from('activity_events').insert
      pattern: "activity_events"
---

<objective>
Wire the contact timeline to the ledger, seed it with prior interactions via backfill, deprecate spine files with comments, and update CLAUDE.md.

Purpose: This is the payoff wave -- the contact detail page now reads from the universal ledger instead of the five-table union. The backfill ensures the timeline is not empty on day one. Spine deprecation makes the architectural intent clear to future sessions.

Output: Contact detail page reads from activity_events. Backfill script ready to run. Spine files marked deprecated. CLAUDE.md updated.
</objective>

<execution_context>
@/Users/alex/crm/.claude/get-shit-done/workflows/execute-plan.md
@/Users/alex/crm/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/alex/crm/.planning/ROADMAP.md
@/Users/alex/crm/.planning/phases/001-slice-1-activity-ledger/001-CONTEXT.md
@/Users/alex/crm/.planning/phases/001-slice-1-activity-ledger/001-01-SUMMARY.md
@/Users/alex/crm/.planning/phases/001-slice-1-activity-ledger/001-02-SUMMARY.md

<interfaces>
<!-- getContactTimeline -- src/lib/activity/queries.ts (Wave 1) -->

    import { getContactTimeline } from '@/lib/activity/queries';
    // Signature: getContactTimeline(contactId: string, limit?: number): Promise<ActivityEvent[]>
    // ActivityEvent is the DB row type from src/lib/activity/types.ts

<!-- ActivityEvent DB type -- src/lib/activity/types.ts -->

    export interface ActivityEvent {
      id: string;
      user_id: string;
      actor_id: string;
      verb: ActivityVerb;   // e.g. 'capture.promoted', 'email.sent', 'interaction.backfilled'
      object_table: string;
      object_id: string;
      context: Record<string, unknown>;
      occurred_at: string;
      created_at: string;
      deleted_at: string | null;
    }

<!-- ActivityFeed component in contacts/[id]/page.tsx -- current props shape -->

    // ActivityFeed currently receives: events: ActivityEvent[] (from contact-activity.ts)
    // That ActivityEvent has: id, source, sourceLabel, iconName, barColorClass, summary, timestamp, badge, sourceId
    // The DB ActivityEvent (from activity/types.ts) has a different shape.
    // Map DB rows to display format inline in the page (no new component needed).
    // Mapping strategy: verb -> sourceLabel + iconName + barColorClass
    //   'capture.promoted' -> sourceLabel='Capture', iconName='Zap', barColorClass='bg-chart-1'
    //   'email.sent'       -> sourceLabel='Email sent', iconName='Mail', barColorClass='bg-primary'
    //   'ticket.status_changed' -> sourceLabel='Ticket updated', iconName='Printer', barColorClass='bg-chart-2'
    //   'project.updated'  -> sourceLabel='Project update', iconName='FolderOpen', barColorClass='bg-chart-4'
    //   'event.created'    -> sourceLabel='Event created', iconName='Calendar', barColorClass='bg-chart-3'
    //   'interaction.backfilled' -> sourceLabel derived from context.type field if present, else 'Interaction'
    //   fallback for unknown verbs -> sourceLabel=verb, iconName='Circle', barColorClass='bg-muted'
    // summary: use context.summary if present, else verb
    // timestamp: occurred_at
    // sourceId: object_id

<!-- contact-activity.ts ActivityEvent (DISPLAY type, NOT the DB type) -->
    // Keep buildActivityFeed and the display ActivityEvent type in contact-activity.ts.
    // Do NOT delete them -- the tabs (Notes, Tasks, FollowUps, Materials) still use
    // those state variables and their fetches. Only the ActivityFeed section changes.
    // Import the DB ActivityEvent as ActivityEventRow to avoid naming collision:
    //   import type { ActivityEvent as ActivityEventRow } from '@/lib/activity/types';

<!-- backfill script runtime pattern -- match auto-enroll-smoke-test.mjs exactly:
     - File extension: .mjs (not .ts)
     - Read .env.local via readFileSync (not dotenv)
     - Use createClient from @supabase/supabase-js directly (not @/ path alias)
     - Plain JavaScript (no TypeScript type annotations)
     - Run with: node scripts/backfill-activity-events.mjs
     - Do NOT use: dotenv, ts-node, @/ path aliases, or TypeScript syntax -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update contact detail page to read Activity Feed from getContactTimeline</name>
  <files>
    src/app/(app)/contacts/[id]/page.tsx
  </files>
  <read_first>
    - /Users/alex/crm/src/app/(app)/contacts/[id]/page.tsx (full file -- know the ActivityFeed section and activityEvents useMemo)
    - /Users/alex/crm/src/lib/contact-activity.ts (know the display ActivityEvent type shape)
    - /Users/alex/crm/src/lib/activity/types.ts (know the DB ActivityEvent shape)
    - /Users/alex/crm/src/lib/activity/queries.ts (confirm getContactTimeline signature)
    - /Users/alex/crm/src/components/contacts/activity-feed.tsx (know what props ActivityFeed expects)
  </read_first>
  <action>
Read activity-feed.tsx first to confirm the props type for ActivityFeed. The component likely accepts `events: ActivityEvent[]` where ActivityEvent is from contact-activity.ts (the display type). Do not change the component. Map the DB rows to the display shape in the page.

**Changes to src/app/(app)/contacts/[id]/page.tsx:**

1. Add import at the top of the file (after existing imports):

       import { getContactTimeline } from '@/lib/activity/queries';
       import type { ActivityEvent as ActivityEventRow } from '@/lib/activity/types';

2. Add state for the ledger-sourced timeline:

       const [ledgerTimeline, setLedgerTimeline] = useState<ActivityEventRow[]>([]);

3. Add a fetch function:

       const fetchLedgerTimeline = useCallback(async () => {
         if (!contactId) return;
         const rows = await getContactTimeline(contactId);
         setLedgerTimeline(rows);
       }, [contactId]);

4. Add `fetchLedgerTimeline` to the useEffect dependency array and call it alongside the other fetches:

       useEffect(() => {
         fetchContact();
         fetchInteractions();
         fetchNotes();
         fetchTasks();
         fetchFollowUps();
         fetchMaterialRequests();
         fetchDesignAssets();
         fetchLedgerTimeline();   // add this line
       }, [
         fetchContact,
         fetchInteractions,
         fetchNotes,
         fetchTasks,
         fetchFollowUps,
         fetchMaterialRequests,
         fetchDesignAssets,
         fetchLedgerTimeline,    // add this to the dep array
       ]);

5. Replace the `activityEvents` useMemo with a ledger-sourced version. Map DB rows to the display ActivityEvent shape that ActivityFeed expects. When ledgerTimeline is empty, fall back to buildActivityFeed so contacts with no ledger rows yet still show history:

       const activityEvents = useMemo(() => {
         if (ledgerTimeline.length === 0) {
           // Ledger empty -- fall back to legacy buildActivityFeed while backfill runs.
           return buildActivityFeed({ interactions, tasks, followUps, materialRequests, designAssets });
         }
         return ledgerTimeline.map((row): import('@/lib/contact-activity').ActivityEvent => {
           const verbLabelMap: Record<string, string> = {
             'capture.promoted': 'Capture',
             'email.sent': 'Email sent',
             'ticket.status_changed': 'Ticket updated',
             'project.updated': 'Project update',
             'event.created': 'Event created',
             'interaction.backfilled': typeof row.context.type === 'string' ? row.context.type : 'Interaction',
           };
           const verbIconMap: Record<string, string> = {
             'capture.promoted': 'Zap',
             'email.sent': 'Mail',
             'ticket.status_changed': 'Printer',
             'project.updated': 'FolderOpen',
             'event.created': 'Calendar',
             'interaction.backfilled': 'Clock',
           };
           const verbColorMap: Record<string, string> = {
             'capture.promoted': 'bg-chart-1',
             'email.sent': 'bg-primary',
             'ticket.status_changed': 'bg-chart-2',
             'project.updated': 'bg-chart-4',
             'event.created': 'bg-chart-3',
             'interaction.backfilled': 'bg-primary',
           };
           const summary = typeof row.context.summary === 'string'
             ? row.context.summary
             : row.verb;
           return {
             id: row.id,
             source: 'interaction' as const,
             sourceLabel: verbLabelMap[row.verb] ?? row.verb,
             iconName: verbIconMap[row.verb] ?? 'Circle',
             barColorClass: verbColorMap[row.verb] ?? 'bg-muted',
             summary,
             timestamp: row.occurred_at,
             sourceId: row.object_id,
           };
         });
       }, [ledgerTimeline, interactions, tasks, followUps, materialRequests, designAssets]);

6. The `hasAnyHistory` check and the `ActivityFeed` component usage below remain unchanged -- they consume `activityEvents` which is still the same display type.

7. Do NOT remove `buildActivityFeed`, `interactions`, `notes`, `tasks`, `followUps`, `materialRequests`, or `designAssets` state or their fetch functions. The other tabs (Notes, Tasks, FollowUps, Materials) still rely on those.
  </action>
  <verify>
    <automated>cd /Users/alex/crm && pnpm typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm typecheck` exits 0
    - `grep "getContactTimeline" /Users/alex/crm/src/app/(app)/contacts/[id]/page.tsx` returns at least 2 matches (import + call)
    - `grep "ledgerTimeline" /Users/alex/crm/src/app/(app)/contacts/[id]/page.tsx` returns at least 4 matches (state, setter, fetch, useMemo)
    - `grep "buildActivityFeed" /Users/alex/crm/src/app/(app)/contacts/[id]/page.tsx` returns a match (fallback path preserved)
    - `pnpm build` exits 0 (no build errors)
  </acceptance_criteria>
  <done>
    Contact detail page Activity Feed reads from getContactTimeline with fallback to buildActivityFeed when ledger is empty. pnpm typecheck and pnpm build pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Write backfill script and add spine deprecation comments</name>
  <files>
    scripts/backfill-activity-events.mjs
    src/lib/spine/parser.ts
    src/lib/spine/queries.ts
    src/lib/spine/types.ts
    supabase/migrations/20260407020000_spine_tables.sql
    supabase/migrations/20260407021000_spine_interactions_trigger.sql
    supabase/migrations/20260408001000_cleanup_spine_smoke_test_data.sql
    CLAUDE.md
  </files>
  <read_first>
    - /Users/alex/crm/src/lib/spine/parser.ts (first 5 lines -- to know existing comment style)
    - /Users/alex/crm/src/lib/spine/queries.ts (first 5 lines)
    - /Users/alex/crm/src/lib/spine/types.ts (first 5 lines)
    - /Users/alex/crm/supabase/migrations/20260407020000_spine_tables.sql (first 5 lines)
    - /Users/alex/crm/CLAUDE.md (know existing sections to place Architecture Notes correctly)
  </read_first>
  <action>
**A. Write /Users/alex/crm/scripts/backfill-activity-events.mjs**

This is a plain JavaScript .mjs file. No TypeScript syntax. No dotenv. No @/ aliases.
Read .env.local via readFileSync exactly as auto-enroll-smoke-test.mjs does.
Run with: `node scripts/backfill-activity-events.mjs`

Exact content:

    #!/usr/bin/env node
    // scripts/backfill-activity-events.mjs
    // One-time backfill: writes interaction.backfilled events for every
    // interactions row from the last 7 days. Idempotent -- checks for existing
    // rows with the same object_id before inserting.
    //
    // Run: node scripts/backfill-activity-events.mjs
    // Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + OWNER_USER_ID in .env.local
    // Slice 1 -- 2026-04-22.

    import { createClient } from '@supabase/supabase-js';
    import { readFileSync } from 'node:fs';
    import { resolve } from 'node:path';
    import { homedir } from 'node:os';

    const envPath = resolve(homedir(), 'crm', '.env.local');
    const env = Object.fromEntries(
      readFileSync(envPath, 'utf8')
        .split('\n')
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => {
          const i = l.indexOf('=');
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
        })
    );

    const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
    const OWNER_USER_ID = env.OWNER_USER_ID;

    for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY, OWNER_USER_ID: OWNER_USER_ID })) {
      if (!v) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    async function main() {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch interactions from last 7 days.
      const { data: interactions, error: fetchErr } = await adminClient
        .from('interactions')
        .select('id, contact_id, type, summary, occurred_at, user_id')
        .gte('created_at', sevenDaysAgo)
        .is('deleted_at', null)
        .order('occurred_at', { ascending: true });

      if (fetchErr) {
        console.error('Failed to fetch interactions:', fetchErr.message);
        process.exit(1);
      }

      if (!interactions || interactions.length === 0) {
        console.log('No interactions in the last 7 days. Nothing to backfill.');
        return;
      }

      console.log(`Found ${interactions.length} interactions to backfill.`);

      let inserted = 0;
      let skipped = 0;

      for (const interaction of interactions) {
        // Idempotency check: skip if an interaction.backfilled event already
        // exists for this object_id.
        const { data: existing } = await adminClient
          .from('activity_events')
          .select('id')
          .eq('object_table', 'interactions')
          .eq('object_id', interaction.id)
          .eq('verb', 'interaction.backfilled')
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        const { error: insertErr } = await adminClient
          .from('activity_events')
          .insert({
            user_id: OWNER_USER_ID,
            actor_id: OWNER_USER_ID,
            verb: 'interaction.backfilled',
            object_table: 'interactions',
            object_id: interaction.id,
            context: {
              contact_id: interaction.contact_id,
              type: interaction.type,
              summary: interaction.summary,
            },
            occurred_at: interaction.occurred_at,
          });

        if (insertErr) {
          console.error(`Failed to insert for interaction ${interaction.id}:`, insertErr.message);
        } else {
          inserted++;
        }
      }

      console.log(`Backfill complete. Inserted: ${inserted}, Skipped (already existed): ${skipped}.`);
    }

    main().catch((err) => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });

**B. Add deprecation comment to each spine TypeScript file**

For each of these three files, prepend the following comment block BEFORE any existing content (on the very first line). Do not change anything else in the file.

    // DEPRECATED (Slice 1, 2026-04-22): spine is superseded by activity_events.
    // Do not extend. Will be deleted in Slice 2.

Files to prepend:
- /Users/alex/crm/src/lib/spine/parser.ts
- /Users/alex/crm/src/lib/spine/queries.ts
- /Users/alex/crm/src/lib/spine/types.ts

**C. Add deprecation comment to each spine migration SQL file**

For each of these three SQL files, prepend the following comment block on the very first line:

    -- DEPRECATED (Slice 1, 2026-04-22): spine tables superseded by activity_events. Will be dropped in Slice 2.

Files to prepend:
- /Users/alex/crm/supabase/migrations/20260407020000_spine_tables.sql
- /Users/alex/crm/supabase/migrations/20260407021000_spine_interactions_trigger.sql
- /Users/alex/crm/supabase/migrations/20260408001000_cleanup_spine_smoke_test_data.sql

**D. Add Architecture Notes section to /Users/alex/crm/CLAUDE.md**

After the existing `## GSD Protocol (CRM only)` section and before `## Build vs Plumbing Protocol`, insert this new section:

    ## Architecture Notes (Slice 1+)

    `activity_events` is the canonical write target for all user-observable actions from Slice 1 onward.
    Every server-side write path emits an event via `writeEvent()` from `src/lib/activity/writeEvent.ts`.
    Do not add new writes to spine tables (spine_inbox, commitments, signals, focus_queue, cycle_state) --
    they are deprecated as of Slice 1 and will be dropped in Slice 2.
    The contact detail page reads its Activity Feed from `getContactTimeline()` in `src/lib/activity/queries.ts`.
  </action>
  <verify>
    <automated>cd /Users/alex/crm && pnpm typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `ls /Users/alex/crm/scripts/backfill-activity-events.mjs` returns the file
    - `grep "interaction.backfilled" /Users/alex/crm/scripts/backfill-activity-events.mjs` returns a match
    - `grep "maybeSingle" /Users/alex/crm/scripts/backfill-activity-events.mjs` returns a match (idempotency check)
    - `grep "readFileSync" /Users/alex/crm/scripts/backfill-activity-events.mjs` returns a match (env loading pattern)
    - `grep "dotenv\|ts-node\|require(" /Users/alex/crm/scripts/backfill-activity-events.mjs` returns 0 matches (no forbidden patterns)
    - `head -1 /Users/alex/crm/src/lib/spine/parser.ts` outputs the DEPRECATED comment
    - `head -1 /Users/alex/crm/src/lib/spine/queries.ts` outputs the DEPRECATED comment
    - `head -1 /Users/alex/crm/src/lib/spine/types.ts` outputs the DEPRECATED comment
    - `head -1 /Users/alex/crm/supabase/migrations/20260407020000_spine_tables.sql` outputs the SQL DEPRECATED comment
    - `grep "Architecture Notes" /Users/alex/crm/CLAUDE.md` returns a match
    - `grep "activity_events" /Users/alex/crm/CLAUDE.md` returns a match
    - `pnpm typecheck` exits 0
    - `pnpm build` exits 0
  </acceptance_criteria>
  <done>
    Backfill script written as .mjs using readFileSync env pattern. Deprecation comments prepended to all 6 spine files. CLAUDE.md Architecture Notes section added. pnpm typecheck and pnpm build pass.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Run backfill script and verify contact timeline end-to-end</name>
  <what-built>
    Backfill script that seeds activity_events from the last 7 days of interactions. Contact detail page now reads its Activity Feed from the ledger. All five write paths emit events going forward.
  </what-built>
  <how-to-verify>
    1. Run the backfill script:

           node /Users/alex/crm/scripts/backfill-activity-events.mjs

       Expected output: "Found N interactions to backfill. Backfill complete. Inserted: N, Skipped..."

    2. Open the CRM dev server (probe port per Rule 17 -- check 3000, then 3001).

    3. Navigate to any contact that has had an interaction in the last 7 days.

    4. Confirm the Activity Feed tab shows entries sourced from activity_events (verb label in the feed will be "Interaction" or the specific type like "Call").

    5. Confirm the Notes, Tasks, FollowUps, and Materials tabs still load their own data independently (those tabs must not be broken by the timeline change).

    6. In Supabase SQL Editor, confirm: `SELECT COUNT(*) FROM activity_events;` returns > 0.

    7. Run: `cd /Users/alex/crm && pnpm typecheck && pnpm build` -- both must pass.
  </how-to-verify>
  <resume-signal>Type "verified" once the feed shows entries and build passes. Describe any issues if the feed is blank or broken.</resume-signal>
  <done>
    Backfill ran successfully. Contact detail page Activity Feed renders entries from activity_events. All tabs functional. pnpm typecheck and pnpm build pass.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| scripts/backfill-activity-events.mjs -> activity_events | Uses adminClient directly. Run locally by Alex only -- not exposed as an API route. |
| Browser client -> activity_events (timeline reads) | RLS enforces user_id = auth.uid(). getContactTimeline uses the browser client. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-001-08 | Repudiation | backfill script | accept | Script records actor_id = OWNER_USER_ID and verb = 'interaction.backfilled'. Context preserves original type + summary. Audit trail is clear. |
| T-001-09 | Tampering | backfill idempotency | mitigate | maybeSingle() check before each insert prevents duplicate rows. Running twice is safe. |
| T-001-10 | Information Disclosure | contact timeline via browser | mitigate | getContactTimeline uses browser Supabase client with RLS. Only auth.uid() rows returned. |
</threat_model>

<verification>
Full end-to-end check after all three tasks:

    cd /Users/alex/crm && pnpm typecheck && pnpm build

Then in Supabase SQL Editor:

    SELECT verb, COUNT(*) FROM activity_events GROUP BY verb ORDER BY COUNT(*) DESC;

Expected: rows for 'interaction.backfilled' (from backfill) plus any real events from the retrofitted write paths.

Also archive the paste file per Rule 22:

    mkdir -p ~/Archive/paste-files/2026-04 && mv ~/Desktop/PASTE-INTO-SUPABASE-activity-events.sql ~/Archive/paste-files/2026-04/
</verification>

<success_criteria>
- Contact detail page Activity Feed reads from getContactTimeline (ledger-first, buildActivityFeed fallback when ledger is empty)
- Backfill script exists as .mjs and ran successfully (activity_events has rows)
- All 6 spine files (3 TS + 3 SQL) have deprecation comments at top
- CLAUDE.md has Architecture Notes section
- pnpm typecheck passes
- pnpm build passes
- Paste file archived from Desktop
</success_criteria>

<output>
After completion, create `/Users/alex/crm/.planning/phases/001-slice-1-activity-ledger/001-03-SUMMARY.md`
</output>
