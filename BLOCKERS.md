# BLOCKERS.md

Broken integrations waiting for a dedicated plumbing session. Build sessions that hit a broken integration **fill-and-flag** (hardcoded fallback + entry here) and keep building.

Each open item: timestamp, what's broken, where it lives (file/line), what's needed to fix. Resolutions move to `## Resolved` with the date and closing commit.

---

## Open

### [2026-04-27] Six non-conforming migration filenames silently skipped by Supabase CLI
- **Broken:** `supabase migration list` (and the CLI's apply / repair flow) skips any file in `supabase/migrations/` whose name doesn't match `<14-digit-timestamp>_<name>.sql`. Six legacy files predate that convention and are therefore invisible to the CLI: `phase-1.3.1-gmail-mvp.sql`, `phase-1.3.2-observation.sql`, `phase-1.4-projects.sql`, `phase-1.5-calendar.sql`, `phase-9-realtime-email-drafts.sql`, `slice-2a-drop-spine.sql`. Their contents have already been applied to remote (`db reset` would not recreate them, but they already exist), so this is registry hygiene, not data risk. Risk surface: any future contributor running `supabase db reset` against a clean local instance would not re-apply them and would diverge from prod.
- **Where:** `supabase/migrations/` -- the six filenames above.
- **Fix needed:** Dedicated plumbing session: rename each to a chronologically-correct timestamp prefix (or leave on disk and explicitly delete from `migrations/` if their DDL is now redundant), then `supabase migration repair --status applied <new-version>` to register. Suggest grouping with future migration-hygiene cleanups.

### [2026-04-25] Slice 3 W3 backfill duplicate interaction.backfilled rows
- **Broken:** Slice 3 W3 backfill discovered 2 pre-existing `interaction.backfilled` rows from Slice 1 backfill (legacy_id=null). Slice 3 backfill created duplicates with legacy_id populated because the `WHERE NOT EXISTS` clause on `context->>'legacy_id'` couldn't match against null. Resolved by soft-deleting the newer Slice 3 rows. Older Slice 1 rows preserved due to potential downstream UUID references.
- **Where:** `activity_events` rows with `verb='interaction.backfilled'` AND `deleted_at IS NOT NULL`. Soft-deleted IDs: `1f376e8c-7d5e-4ef7-be15-06ee31a87681`, `e0c895bb-9070-45ed-a12b-145c04693a0e`.
- **Fix needed:** None required. Future: if anyone investigates `interaction.backfilled WHERE deleted_at IS NOT NULL`, these are the 2 known soft-deletes -- not a data integrity issue.

### [2026-04-21] `contacts` table missing `slug`, `photo_url`, `tagline` columns
- **Broken:** No DB-backed source for agent landing page data. `/agents/[slug]` cannot query Supabase for the agent record.
- **Where:** `src/app/agents/[slug]/page.tsx` -- `AGENTS` const hardcoded at top of file (Julie + Fiona + Denise for Sessions 2-4).
- **Fix needed:** Supabase migration adding `contacts.slug text unique`, `contacts.photo_url text`, `contacts.tagline text`; backfill Julie + Fiona + Denise; then refactor the page to `await supabase.from('contacts').select(...).eq('slug', slug).single()`. Keep RLS open for anon SELECT on those three columns only.

### [2026-04-21] Fiona Bigbee + Denise van den Bossche phone/website missing from CONTACT.md
- **Broken:** Contact block on `/agents/fiona-bigbee` and `/agents/denise-van-den-bossche` renders email only. `AgentRecord.phone|phoneHref|website|websiteHref` set to `null`; conditional render hides the rows. `RealEstateAgent` JSON-LD `telephone` + `url` fields ship as `null` on both pages.
- **Where:** `src/app/agents/[slug]/page.tsx` -- `AGENTS["fiona-bigbee"]` and `AGENTS["denise-van-den-bossche"]`. Upstream source: `~/Documents/Alex Hub(Obs)/05_AGENTS/Fiona Bigbee/CONTACT.md` and `~/Documents/Alex Hub(Obs)/05_AGENTS/Denise van den Bossche/CONTACT.md` (email-only at present).
- **Fix needed:** Alex confirms phone + website (or website=none) for each. Update both CONTACT.md files to include phone + website fields, then backfill the `AGENTS` const (or `contacts.phone` / `contacts.website` once Blocker #1 resolves). Carrying through Session 4; pages read as partial contact coverage until fixed.

### [2026-04-21] Voice / mic capture not wired
- **Broken:** Universal Capture Bar v1 ships text-only. No mic button, no audio input, no Web Speech API fallback. Spec called for voice as a v1 option; deferred during planning so the delight moment (live parse preview) could land first.
- **Where:** `src/components/capture-bar.tsx` -- input is a single `<input type="text">`. No MediaRecorder / webkitSpeechRecognition path exists.
- **Fix needed:** Add mic button inside the bar, request mic permission, stream to `webkitSpeechRecognition` (Chrome/Edge/Safari) with a `MediaRecorder` -> server-side transcription fallback for Firefox / no-webkit-speech browsers. Transcript populates the same `captures.raw_text` field so the existing parser still runs unchanged.

### [2026-04-22] Inline contact picker for captures missing a contact
- **Broken:** When `parsed_intent` is `interaction` / `note` / `follow_up` but the rule parser didn't match a contact, the process route rejects with 400 "Needs a contact" and the UI swaps the Process button for a disabled "Needs contact" pill. Alex's only recourse is to stop, mark the capture as stuck, and re-capture with a name the parser recognizes. There's no inline affordance to assign a contact to the existing capture.
- **Where:** `src/lib/captures/promote.ts:71-77` (400 guard). `src/app/(app)/captures/captures-client.tsx:162` (`missingRequiredContact` → "Needs contact" pill). No contact-search UI lives on the capture row.
- **Fix needed:** Render a small "Assign contact" affordance on the row when `missingRequiredContact === true`. Clicking opens a contact search popover (same pattern as `cmdk` `Command` menus already in the app) that writes `captures.parsed_contact_id` + appends to `parsed_payload.contact_assigned_at`. Once set, re-enable the Process button and let `promoteCapture` run the normal path. Optional: PATCH route at `/api/captures/[id]` for the assign write; or reuse existing capture update logic if the edit-after-submit blocker lands first.


### [2026-04-23] captures-audio lifecycle: cleanup cron not wired to Vercel scheduler
- **Broken:** `src/app/api/captures/cleanup-audio/route.ts` exists and deletes storage objects
  older than 30 days, but is not wired to any automated schedule. Audio files accumulate
  indefinitely until this is wired.
- **Where:** `vercel.json` (does not yet have a crons entry for this route).
- **Fix needed:** Add to vercel.json:
  `{ "path": "/api/captures/cleanup-audio", "schedule": "0 12 * * *" }`
  and ensure CRON_SECRET env var is set in Vercel project settings.

### [2026-04-23] tier-alerts.tsx deleted -- needs Slice 2B rebuild
- **Broken:** `src/components/today/tier-alerts.tsx` deleted in Slice 2A (spine-only data source). Visible gap on /today until replaced.
- **Where:** Was rendered in `src/app/(app)/today/today-client.tsx`. Section A in the original layout.
- **Fix needed:** Slice 2B build session: rewrite component reading from activity_events (or contacts/interactions) instead of the deprecated spine payload. Wire replacement back into today-client.tsx.

### [2026-04-23] overdue-commitments.tsx deleted -- needs Slice 2B rebuild
- **Broken:** `src/components/today/overdue-commitments.tsx` deleted in Slice 2A (spine-only data source). Visible gap on /today until replaced.
- **Where:** Was rendered in `src/app/(app)/today/today-client.tsx`. Section B in the original layout.
- **Fix needed:** Slice 2B build session: rewrite component reading from activity_events (or contacts/interactions) instead of the deprecated spine payload. Wire replacement back into today-client.tsx.

### [2026-04-23] today-focus.tsx deleted -- needs Slice 2B rebuild
- **Broken:** `src/components/today/today-focus.tsx` deleted in Slice 2A (spine-only data source). Visible gap on /today until replaced.
- **Where:** Was rendered in `src/app/(app)/today/today-client.tsx`. Section C in the original layout.
- **Fix needed:** Slice 2B build session: rewrite component reading from activity_events (or contacts/interactions) instead of the deprecated spine payload. Wire replacement back into today-client.tsx.

### [2026-04-23] recent-captures.tsx deleted -- needs Slice 2B rebuild
- **Broken:** `src/components/today/recent-captures.tsx` deleted in Slice 2A (spine-only data source). Visible gap on /today until replaced.
- **Where:** Was rendered in `src/app/(app)/today/today-client.tsx`. Section F in the original layout.
- **Fix needed:** Slice 2B build session: rewrite component reading from activity_events (or contacts/interactions) instead of the deprecated spine payload. Wire replacement back into today-client.tsx.

### [2026-04-23] week-stats.tsx deleted -- needs Slice 2B rebuild
- **Broken:** `src/components/today/week-stats.tsx` deleted in Slice 2A (spine-only data source). Visible gap on /today until replaced.
- **Where:** Was rendered in `src/app/(app)/today/today-client.tsx`. Section G in the original layout.
- **Fix needed:** Slice 2B build session: rewrite component reading from activity_events (or contacts/interactions) instead of the deprecated spine payload. Wire replacement back into today-client.tsx.

### [2026-04-21] Capture editing after submit not wired
- **Broken:** Captures are immutable by design for v1. If Alex fat-fingers a capture or wants to fix a parsed intent, the only option is to stop, mark processed, and re-capture. No inline edit UI.
- **Where:** `src/app/(app)/captures/captures-client.tsx` -- renders `raw_text` as static `<p>`; no edit affordance. No PATCH route on `/api/captures/[id]`.
- **Fix needed:** Add an inline edit mode on each row (pencil affordance -> textarea + save/cancel). PATCH `/api/captures/[id]` re-runs the parser on save and updates `raw_text` + `parsed_intent` + `parsed_contact_id` + `parsed_payload`. Append the prior values to `parsed_payload.edits[]` with a timestamp so the audit trail is preserved.

---

## Resolved

### [2026-04-21] Claude API intent parser upgrade deferred -- RESOLVED 2026-04-27 (Slice 6)
- Resolution: `src/lib/ai/capture-parse.ts` ships `parseCaptureWithAI()` -- structured-JSON intent parser routed through `callClaude` (cache + budget guard + ai_usage_log). Wired into `src/app/api/captures/route.ts` POST handler behind `CAPTURES_AI_PARSE=true` feature flag (default off pending 7-day soak; flag flip logged to LATER.md). Rule parser at `src/lib/captures/rules.ts` remains primary path and is the guaranteed fallback when AI returns invalid JSON or fails. Live preview line in `capture-bar.tsx` continues to use the rule parser for instant feedback; AI pass runs only on submit.

### [2026-04-22] "New Agent Onboarding" campaign row not yet created -- RESOLVED 2026-04-27 (Slice 5A)
- Campaign row `e13653af-405e-4118-bade-d45d31830b86` (name='New Agent Onboarding', status='active') was already on the books with 4 step rows in place (delay_days = 0/3/7/14, step_type='email', inline email_subject + email_body_html). Slice 5A ratified them: created 4 templates (`new-agent-onboarding-step-1`..`-4`, kind='campaign', send_mode='gmail', subject + body_html + body_text imported from each step's inline copy), backfilled `template_slug` on each step row, and added the column + partial index so the campaign-runner cron route can resolve through templates.
- Three secondary fixes shipped alongside: (a) runner re-keyed scheduling to absolute-from-`enrolled_at` so existing data 0/3/7/14 yields Day 0/3/7/14 cadence (commit `d530c1c`); (b) `autoEnrollNewAgent()` now inserts `current_step=0` and explicit `user_id` (commit `57774e7`) -- previously `current_step=1` would have skipped step 1 entirely and the missing user_id would have failed the NOT NULL constraint under service-role context; (c) runner's `actorId` switched from string sentinel to `enrollment.user_id` (commit `73f7cfe`) so writeEvent's uuid column accepts the value.
- Closing commits: `56e6fa4` (Task 4 column add), `d530c1c` (Task 3 follow-up runner semantics), `57774e7` (Task 7 + 8 -- autoEnroll + webhook), `73f7cfe` (Task 10 runner actorId fix). Slice 5A also seeded the Agent Nurture campaign (id `85af274e-ae78-4a32-9915-fefb952dda43`) + 2 templates + 2 steps (Day 0 monthly recap + Day 30 soft re-engage) for future manual enrollment.

### [2026-04-26] Slice 4 follow-up: migrate /api/inbox/scan to oauth_tokens-backed sync client -- RESOLVED 2026-04-27 (Slice 4)
- `/api/inbox/scan` now imports `fetchUnreadThreads` from `src/lib/gmail/sync-client.ts` (oauth_tokens-backed via `loadTokens()` + `getOAuth2Client()`). Legacy `src/lib/gmail/client.ts` deleted; no remaining callers. `GOOGLE_REFRESH_TOKEN` env removal instructions written to `~/Desktop/PASTE-INTO-ENV-slice4-google-refresh-token-removal.txt` for Alex to apply across `.env.local` + Vercel preview + production + `.env.example`. Live smoke (curl `/api/inbox/scan` + OAuth re-authorize) deferred to Alex's runtime testing before final acceptance.
- Closing commits: `add681b` (migration + client.ts delete) + `57a6c99` (recovery hotfix for SQL files clobbered in same commit).

### [2026-04-24] Slice 3B follow-up: rename src/lib/captures/parse.ts -> rules.ts -- RESOLVED 2026-04-26 (Slice 3B)
- File renamed via `git mv` (blame preserved). Three import sites updated: `src/app/api/captures/route.ts`, `src/components/capture-bar.tsx`, and `src/components/capture-bar-server.tsx` (a third caller of `type ContactIndexEntry` not listed in the original blocker; updated to keep the acceptance grep clean).
- Closing commit: `01cc954`.

### [2026-04-24] Slice 3B follow-up: fold src/lib/captures/promote.ts -> actions.ts -- RESOLVED 2026-04-26 (Slice 3B)
- `promoteCapture` and helpers (`mapKeywordToInteractionType`, `buildTicketTitle`, `defaultFollowUpDueDate`, plus private `ProjectHintRequiredError` / `ensureProject` / `markCapturePromoted`) moved verbatim from `src/lib/captures/promote.ts` into `src/lib/captures/actions.ts`. `promote.ts` deleted. Single caller `src/app/api/captures/[id]/process/route.ts` updated to import from `@/lib/captures/actions`.
- Closing commit: `5a472d8`.

### [2026-04-24] Slice 3B follow-up: fold src/lib/campaigns/auto-enroll.ts -> actions.ts -- RESOLVED 2026-04-26 (Slice 3B)
- `autoEnrollNewAgent` (+ private types) moved from `src/lib/campaigns/auto-enroll.ts` into `src/lib/campaigns/actions.ts`. `auto-enroll.ts` deleted. Three import sites updated: `src/app/api/contacts/route.ts`, `src/app/api/contacts/[id]/auto-enroll/route.ts`, `src/lib/intake/process.ts`.
- Closing commit: `c4e6fef`.

### [2026-04-24] Slice 3B follow-up: promote src/lib/events/invite-templates/ to top-level files -- RESOLVED 2026-04-26 (Slice 3B)
- 8 sub-files (types, signature, shell, four renderers, index barrel) consolidated into single `src/lib/events/invite-templates.ts`. Public surface unchanged from prior `index.ts` barrel. Two consolidations to avoid duplicate-identifier errors: four private `buildPlainText` helpers renamed to `buildHomeTourPlainText` / `buildClassDayPlainText` / `buildContentDayPlainText` / `buildHappyHourPlainText`; three identical private `firstName` helpers collapsed into one shared module-private helper. One existing import site (`src/app/api/events/invite-preview/route.ts`) keeps working unchanged because Node resolves `@/lib/events/invite-templates` to the new `.ts` file when no directory of that name is present.
- Closing commit: `6485d77`.

### [2026-04-24] Slice 2C: writers still INSERT directly into interactions_legacy -- RESOLVED 2026-04-24 (Slice 3)
- All 6 INSERT call sites migrated. Server-side callers (`src/lib/captures/promote.ts`, `src/app/api/intake/route.ts`, `src/app/api/webhooks/resend/route.ts`) call `writeEvent()` directly with verb=`interaction.{type}`; client-side callers (`src/app/(app)/actions/page.tsx`, `src/components/dashboard/task-list.tsx` x2, `src/components/interactions/interaction-modal.tsx`) post to new endpoint at `src/app/api/activity/interaction/route.ts` which authenticates the user and writes the activity_events row server-side. ActivityVerb union extended with 10 `interaction.*` verbs in `src/lib/activity/types.ts`.
- Verification: `grep -rn "from('interactions_legacy').insert" src/` returns zero hits.
- Closing branch: `gsd/005-slice-3-interactions-routes-cleanup`.

### [2026-04-24] Slice 2C: interactions_legacy table -- drop deferred to Slice 3 -- RESOLVED 2026-04-24 (Slice 3)
- W3 backfill migration writes the 2 legacy rows into activity_events with verb='interaction.backfilled' and context.legacy_id idempotency guard. W4 migration rewrites the interactions VIEW to drop Part A (project from activity_events only) and drops interactions_legacy CASCADE.
- Realtime channels in `src/components/dashboard/task-list.tsx:374` and `src/app/(app)/contacts/page.tsx:145` flipped to subscribe to `activity_events` with verb-prefix filter inside the callback. activity_events added to `supabase_realtime` publication.
- Migration files: `supabase/migrations/20260425110000_slice3_legacy_backfill.sql` + `supabase/migrations/20260425120000_slice3_view_rewrite_drop_legacy.sql`. Bundled paste at `~/Desktop/PASTE-INTO-SUPABASE-slice3.sql`.

### [2026-04-24] Slice 2C: tasks.completed_via_interaction_id audit linkage lost -- RESOLVED 2026-04-24 (Slice 3)
- Added `tasks.linked_interaction_id uuid` with FK to `activity_events(id) ON DELETE SET NULL` and partial index `idx_tasks_linked_interaction_id`. Migration: `supabase/migrations/20260425100000_slice3_tasks_linked_interaction_id.sql`.
- The completeFollowUp mutation in `src/components/dashboard/task-list.tsx` now POSTs to `/api/activity/interaction`, captures the returned event_id, and writes it back into `tasks.linked_interaction_id` in the same UPDATE that marks the follow-up completed. Audit linkage restored.
- Task interface in `src/lib/types.ts` extended with optional `linked_interaction_id?: string | null`.

### [2026-04-22] interactions_update_cycle trigger still live -- RESOLVED 2026-04-23
- Migration file written at `supabase/migrations/slice-2a-drop-spine.sql`. `DROP TRIGGER IF EXISTS interactions_update_cycle ON public.interactions;` appears as first statement before all DROP TABLE calls. Alex executes manually.

### [2026-04-21] Capture -> downstream promotion not wired -- RESOLVED 2026-04-22
- Process route at `src/app/api/captures/[id]/process/route.ts` now delegates to a new `promoteCapture()` helper at `src/lib/captures/promote.ts`. The switch: `interaction` + `note` insert `interactions` rows (type mapped from `parsed_payload.intent_keyword` with `note` fallback); `follow_up` inserts a `follow_ups` row with `due_date = created_at + 3 days` and `reason = raw_text`; `ticket` inserts a `material_requests` row with `request_type='design_help'`, `status='draft'`, `source='internal'`, title truncated to 80 chars, full raw text preserved in `notes`.
- Audit trail: `captures.parsed_payload.{promoted_to, promoted_id, promoted_at}` persisted on success; `processed=true` flipped only after the downstream row lands.
- Guards: `unprocessed` intent → 400; `interaction`/`note`/`follow_up` with no matched contact → 400 "Needs a contact" (ticket allowed with null contact since `material_requests.contact_id` is nullable); already-processed capture → 409 with existing `promoted_id`.
- `/captures` UI at `src/app/(app)/captures/captures-client.tsx` now reads the payload fields and renders "Promoted → {label} (view)" linked to `/contacts/<id>` (interactions + follow_ups) or `/materials` (tickets). Process button is swapped for a "Needs contact" or "Nothing to promote" pill when the capture can't promote.
- `pnpm typecheck` PASS, `pnpm lint` PASS (zero warnings), `pnpm build` PASS (`/captures` 2.39 kB, 117 kB first-load).
- New Blocker #7 logged (inline contact picker) for v2 follow-up.
- Closing commit: `b56a5b0`.

### [2026-04-21] Julie headshot not in `/public/agents/` -- RESOLVED 2026-04-21
- Converted `~/Documents/Agents/Julie Jarmiolowski/Kaygrant/Julie_2022_Headshot_(1).png` (157KB PNG) to `/public/agents/julie-jarmiolowski.jpg` via `sips -s format jpeg -s formatOptions 85 -Z 800` (800×798 JPEG, 179KB).
- Updated `AGENTS["julie-jarmiolowski"].photoUrl` from the Andrea brochure fallback to `/agents/julie-jarmiolowski.jpg` in `src/app/agents/[slug]/page.tsx`.
- `pnpm typecheck` PASS, `pnpm build` PASS; `/agents/julie-jarmiolowski` still prerenders as SSG alongside Fiona + Denise.
- Closing commit: `a0ac043` (prod deploy `dpl_DthBaahUUniqmTYrQYEhS2aFNWnM`, aliased to `gat-bos.vercel.app`).

### [2026-04-21] Julie Jarmiolowski tagline not written -- RESOLVED 2026-04-21
- Alex approved Kit Screen hero-voice drafts J1/F1/D1; Julie tagline locked as: "Optima Camelview resident and realtor, guiding neighbors through one of the Valley's most architectural addresses."
- Patched inline in `src/app/agents/[slug]/page.tsx` (`AGENTS["julie-jarmiolowski"].tagline`). Blocker #2 comment removed.
- Once Blocker #1 resolves, this string moves to `contacts.tagline`.
- Closing commit: `a0ac043` (prod deploy `dpl_DthBaahUUniqmTYrQYEhS2aFNWnM`, aliased to `gat-bos.vercel.app`).

### [2026-04-21] Fiona Bigbee + Denise van den Bossche taglines not written -- RESOLVED 2026-04-21
- Alex approved Kit Screen hero-voice drafts J1/F1/D1; Fiona tagline locked as: "85258 is my backyard. Your next move starts with the agent who knows every block." Denise tagline locked as: "Paradise Valley and Scottsdale, handled quietly. Discretion is the service."
- Patched inline in `src/app/agents/[slug]/page.tsx` (`AGENTS["fiona-bigbee"].tagline` + `AGENTS["denise-van-den-bossche"].tagline`). Blocker #5 comments removed.
- Once Blocker #1 resolves, these strings move to `contacts.tagline`.
- Closing commit: `a0ac043` (prod deploy `dpl_DthBaahUUniqmTYrQYEhS2aFNWnM`, aliased to `gat-bos.vercel.app`).

---

Remaining placeholders in this file: none. No `CONFIRM:` / `MISSING TOKEN:` / `TBD:` markers beyond what's scoped in each Open entry.
