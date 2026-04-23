# Phase 003: Slice 2B -- Captures Consolidation - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Source:** Slice 2B starter block (session-verified, all pre-conditions confirmed 2026-04-23)

<domain>
## Phase Boundary

Consolidate three legacy source tables (voice_memos, intake_queue, email_inbox) into captures via migration,
extend the captures schema with 4 new columns plus a status column, refactor promote.ts to accept 5 explicit
promotion targets, create a captures-audio storage bucket, and add a cleanup cron route. No new UI pages,
no new public routes other than the cleanup cron.

This is a pure plumbing session: schema migrations, TypeScript type updates, server-side lib refactor,
storage setup.

</domain>

<decisions>
## Implementation Decisions

### Branch
- Create branch before any file changes: git checkout -b gsd/003-slice-2b-captures-consolidation

### Pre-condition findings (verified 2026-04-23)
- spine_inbox: absent (already dropped). Skip spine_inbox INSERT entirely.
- voice_memos: exists, 0 rows. INSERT is a no-op; DROP still fires.
- intake_queue: exists, 0 rows. INSERT is a no-op; DROP still fires.
- email_inbox: exists, 0 rows. INSERT is a no-op; DROP still fires.
- captures columns today: id, created_at, updated_at, raw_text, parsed_intent, parsed_contact_id,
  parsed_payload, processed (boolean), user_id
- All 4 new columns (source, suggested_target, transcript, metadata) are MISSING -- add all 4
- captures has NO status column (only processed: boolean) -- add status column in Task 2 migration

### Task 0 -- Branch setup
- git checkout -b gsd/003-slice-2b-captures-consolidation before any file changes

### Task 1 -- Data merge migration
- File: supabase/migrations/[YYYYMMDDHHMMSS]_slice2b_captures_merge.sql
  (use current timestamp at execution time, e.g. 20260423120000_slice2b_captures_merge.sql)
- All INSERTs use ON CONFLICT (id) DO NOTHING for idempotency
- spine_inbox INSERT is SKIPPED (table absent from Supabase)
- Column mappings:
  - voice_memos  -> captures: source='voice_memo', raw_text=raw_transcript, transcript=raw_transcript,
                     metadata=processed_output, user_id=user_id
  - intake_queue -> captures: source='intake', raw_text=raw_input, metadata=parsed_data, user_id=user_id,
                     WHERE deleted_at IS NULL
  - email_inbox  -> captures: source='email_inbox',
                     raw_text=COALESCE(body_preview, subject, ''),
                     parsed_contact_id=contact_id,
                     metadata=jsonb_build_object('gmail_id',gmail_id,'from_email',from_email,
                               'from_name',from_name,'subject',subject,'priority_score',priority_score),
                     user_id=user_id
- After all INSERTs: DROP TABLE IF EXISTS voice_memos, intake_queue, email_inbox CASCADE

### Task 2 -- Schema changes to captures (same migration file as Task 1, after DROPs)
- ALTER TABLE captures ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
- ALTER TABLE captures ADD COLUMN IF NOT EXISTS suggested_target jsonb
- ALTER TABLE captures ADD COLUMN IF NOT EXISTS transcript text
- ALTER TABLE captures ADD COLUMN IF NOT EXISTS metadata jsonb
- ALTER TABLE captures ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
- ADD CONSTRAINT IF NOT EXISTS captures_source_check
    CHECK (source IN ('manual','spine_inbox','voice_memo','intake','email_inbox','audio'))
- ADD CONSTRAINT IF NOT EXISTS captures_status_check
    CHECK (status IN ('pending','promoted','discarded'))
- CREATE INDEX IF NOT EXISTS idx_captures_source ON captures(source)
- UPDATE captures SET source = 'manual' WHERE source IS NULL
- UPDATE captures SET status = 'promoted' WHERE processed = true AND status = 'pending'

### Task 3 -- TypeScript types (two files)

**src/lib/types.ts:**
- Expand PromotedTarget union: add 'task' | 'contact' | 'touchpoint' | 'event'
  (existing: "interaction" | "follow_up" | "ticket")
  New: "interaction" | "follow_up" | "ticket" | "task" | "contact" | "touchpoint" | "event"
- Add SuggestedTarget type:
  ```typescript
  export type SuggestedTarget = {
    type?: 'task' | 'ticket' | 'contact' | 'touchpoint' | 'event'
    project_hint?: { name: string; contact_id?: string }
    contact_id?: string
  }
  ```
- Capture interface: add these fields
  - source: string (new column, default 'manual')
  - suggested_target?: SuggestedTarget | null
  - transcript?: string | null
  - metadata?: Record<string, unknown> | null
  - status: string (new column, default 'pending')

**src/lib/activity/types.ts:**
- Add 5 new ActivityVerb values (dot-notation to match existing convention):
  'capture.promoted.task', 'capture.promoted.ticket', 'capture.promoted.contact',
  'capture.promoted.touchpoint', 'capture.promoted.event'
- Keep existing 'capture.promoted' for legacy backward compat

### Task 4 -- Refactor promote.ts
- Read the current file first -- do NOT replace working patterns, extend them
- Add promoteTarget?: 'task' | 'ticket' | 'contact' | 'touchpoint' | 'event'
  as an OPTIONAL field to PromoteInput
- When promoteTarget is provided, use explicit routing; when absent, fall back to
  existing parsed_intent routing (backward compat for old DB rows)
- Switch all DB writes from passed supabase client to adminClient (import from @/lib/supabase/admin)
  The supabase parameter can be removed from PromoteInput entirely
- Add ensureProject helper (same file):
  async function ensureProject(hint: SuggestedTarget['project_hint'] | undefined): Promise<string>
  INSERT INTO projects (title, contact_id, owner_contact_id, status, user_id)
  ON CONFLICT DO NOTHING  (or UPSERT) RETURNING id
  If hint is undefined AND target requires project_id, throw typed ProjectHintRequiredError
- New explicit target handlers:
  - 'task': INSERT INTO tasks (user_id, contact_id, title, description, due_date, priority)
             title = buildTicketTitle(rawText), due_date = defaultFollowUpDueDate(created_at),
             priority = 'medium', contact_id from capture.parsed_contact_id (nullable)
  - 'contact': INSERT INTO contacts (user_id, first_name, last_name, source)
               Parse name from rawText: split(' ') -- first word = first_name, rest = last_name
               source = 'manual', relationship = 'new'
               Or use suggested_target.contact_id if present (upsert to existing)
  - 'touchpoint': ensureProject first, then INSERT INTO project_touchpoints
                  (project_id, touchpoint_type='contact_note', entity_id=capture.id,
                   entity_table='captures', occurred_at=now(), note=rawText)
  - 'event': ensureProject first, then INSERT INTO events
             (user_id, title=rawText[:80], start_at=now(), end_at=now()+1hr,
              attendees='[]'::jsonb, source='dashboard_create', occurrence_status='scheduled',
              project_id from ensureProject, contact_id from capture.parsed_contact_id)
- After entity created: UPDATE captures SET status = 'promoted' WHERE id = capture.id
  (use adminClient directly, not the return value of supabase)
- writeEvent per new target type: verb = 'capture.promoted.task' | 'capture.promoted.contact' | etc.
  Existing promoted events for old targets keep verb 'capture.promoted' for backward compat

### Task 4 -- Process route impact
- src/app/api/captures/[id]/process/route.ts currently passes supabase to promoteCapture
- After Task 4, promoteCapture no longer accepts supabase -- remove that param from the call
- Process route still updates processed=true + parsed_payload via supabase (RLS path) after promoteCapture returns ok:true

### Task 5 -- Storage bucket (captures-audio)
- Check bucket existence: SELECT id FROM storage.buckets WHERE id = 'captures-audio'
- If absent: INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('captures-audio', 'captures-audio', false, 52428800,
          ARRAY['audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/webm'])
  ON CONFLICT (id) DO NOTHING
- Create cleanup cron at: src/app/api/captures/cleanup-audio/route.ts
  - export const runtime = "nodejs"
  - GET handler
  - verifyCronSecret(request) from @/lib/api-auth
  - adminClient from @/lib/supabase/admin
  - DELETE FROM storage.objects WHERE bucket_id = 'captures-audio'
    AND created_at < now() - interval '30 days'
  - Return NextResponse.json({ deleted: count })
- Log to BLOCKERS.md under Open:
  "captures-audio lifecycle: native TTL not available, cleanup cron at /api/captures/cleanup-audio
   -- wire to Vercel cron in vercel.json"

### Task 6 -- Apply migration and verify
- cd ~/crm && supabase db push --linked
- If push fails (Docker not running): write SQL to ~/Desktop/PASTE-INTO-SUPABASE-slice2b.sql and STOP
- Verify via db query: 4 new schema columns on captures, 0 rows for dropped tables
- pnpm typecheck -- must exit 0
- pnpm build -- must exit 0
- Report PASS/FAIL explicitly

### Task 7 -- Git commit + BUILD.md + BLOCKERS.md
- Stage only slice-2b files
- Commit: "plumbing(003): Slice 2B -- captures consolidation and promote refactor"
- UPDATE BUILD.md: move Slice 2B to Built with date 2026-04-23
- ADD to BLOCKERS.md Open: captures-audio lifecycle blocker

### Task 8 -- Tag and PR
- git tag slice-2b-complete
- gh pr create --title "Slice 2B: Captures consolidation" (follow CLAUDE.md PR format)

### Out of scope (do not touch)
- Tasks/opportunities table merge (Slice 2C)
- Any UI components, pages, or route changes other than cleanup cron
- RLS policy changes (captures RLS already in place)
- Audio transcription APIs (storage only)
- Changes to contacts, projects, or events tables beyond what promote.ts creates
- Changes to activity_events schema
- Gmail integration or email parsing changes
- Changes to /drafts or /today routes
- src/lib/activity/ (Slice 1 canonical output, do not touch)
- No Twilio, Zapier, or SMS

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Captures system (READ BEFORE TOUCHING)
- `src/lib/captures/promote.ts` -- current promoteCapture implementation
- `src/app/api/captures/[id]/process/route.ts` -- caller of promoteCapture
- `src/lib/types.ts` lines 436-476 -- Capture, CapturePayload, PromotedTarget, ParsedIntent types
- `src/lib/activity/types.ts` -- ActivityVerb union (dot-notation convention)

### Verified database state (2026-04-23)
- captures columns: id, created_at, updated_at, raw_text, parsed_intent, parsed_contact_id,
  parsed_payload, processed (boolean), user_id
- Source tables: voice_memos (0 rows), intake_queue (0 rows), email_inbox (0 rows) -- all exist
- spine_inbox: absent from Supabase already

### Source table schemas (for Task 1 SQL)
- voice_memos: id (uuid), user_id (uuid), raw_transcript (text), processed_output (jsonb),
  contact_ids (uuid[]), status (text), created_at, updated_at
- intake_queue: id (uuid), user_id (uuid), source (text), raw_input (text), parsed_data (jsonb),
  status (text), target_table (text), target_id (uuid), error_message (text), processed_at,
  created_at, updated_at, deleted_at
- email_inbox: id (uuid), user_id (uuid), gmail_id (text), from_email (text), from_name (text),
  subject (text), body_preview (text), received_at, contact_id (uuid), priority_score (smallint),
  status (text), suggested_action (text), draft_reply (text), created_at, updated_at

### Enum values needed for Task 4
- project_touchpoint_type: 'email', 'event', 'voice_memo', 'contact_note'
  --> use 'contact_note' for capture-promoted touchpoints
- event_source: 'gcal_pull', 'dashboard_create'
  --> use 'dashboard_create' for capture-promoted events
- event_occurrence_status: 'scheduled', 'confirmed', 'completed', 'canceled'
  --> use 'scheduled' for capture-promoted events
- contact_source (from schema.sql): 'manual', 'referral', etc.
  --> use 'manual' for capture-promoted contacts

### Cron route pattern
- `src/app/api/cron/recompute-health-scores/route.ts` -- canonical cron pattern to replicate
- `src/lib/api-auth.ts` -- verifyCronSecret helper
- `src/lib/supabase/admin.ts` -- adminClient

### Activity event system
- `src/lib/activity/writeEvent.ts` -- writeEvent helper (adminClient, fire-and-forget)

### Migration naming convention
- supabase/migrations/[YYYYMMDDHHMMSS]_slug.sql
  (e.g. 20260423120000_slice2b_captures_merge.sql)

</canonical_refs>

<specifics>
## Specific Ideas

### status column gap
captures currently has NO status column -- only processed: boolean.
Task 2 migration must ADD status text NOT NULL DEFAULT 'pending'.
Backfill: UPDATE captures SET status = 'promoted' WHERE processed = true.

### ActivityVerb naming convention
Existing verbs use dot-notation: 'capture.promoted', 'ticket.status_changed', 'email.sent'.
New verbs MUST follow dot-notation: 'capture.promoted.task', 'capture.promoted.ticket',
'capture.promoted.contact', 'capture.promoted.touchpoint', 'capture.promoted.event'.
Do NOT use underscores. The starter block used underscore notation as examples; the codebase
convention is dots.

### promoteCapture backward compat strategy
- Add promoteTarget as OPTIONAL (not required) to PromoteInput
- Existing callers (process route) pass no promoteTarget -- routed by parsed_intent as before
- New callers can pass explicit promoteTarget to use new target handlers
- promoteCapture sets captures.status='promoted' via adminClient after entity creation

### ensureProject shape
- projects table likely has: title, owner_contact_id, user_id, status, deleted_at
- Check projects table columns before writing the INSERT
- ON CONFLICT: if projects has unique(title, owner_contact_id) or similar, use that
- READ src/app/api/projects/route.ts or similar to see current project insert pattern

### events table columns for Task 4
events: id, gcal_event_id, title (NOT NULL), description, start_at (NOT NULL), end_at (NOT NULL),
location, attendees (jsonb NOT NULL), project_id, contact_id, source (event_source NOT NULL),
synced_at, created_at, updated_at, deleted_at, event_template_id, location_override,
occurrence_status (event_occurrence_status NOT NULL)

### project_touchpoints columns for Task 4
project_touchpoints: id, project_id (NOT NULL), touchpoint_type (project_touchpoint_type NOT NULL),
entity_id (NOT NULL), entity_table (NOT NULL), occurred_at, note, created_at

</specifics>

<deferred>
## Deferred Ideas

- Audio transcription API integration (Slice 2B is storage-only)
- Inline contact picker for captures (Blocker #7, separate v2 work)
- Capture editing after submit (Blocker #9, separate v2 work)
- interactions/notes table merge into captures (later slice)
- /today rebuild for deleted spine components (separate build session)
- Wire cleanup-audio cron to vercel.json (logged to BLOCKERS.md, deferred)
- Changing ParsedIntent to use new 5-target taxonomy (future: when capture bar emits new intents)

</deferred>

---

*Phase: 003-slice-2b-captures-consolidation*
*Context gathered: 2026-04-23 via Slice 2B starter block (session-verified)*
