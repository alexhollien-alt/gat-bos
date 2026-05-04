# BLOCKERS.md

Broken integrations waiting for a dedicated plumbing session. Build sessions that hit a broken integration **fill-and-flag** (hardcoded fallback + entry here) and keep building.

Each open item: timestamp, what's broken, where it lives (file/line), what's needed to fix. Resolutions move to `## Resolved` with the date and closing commit.

---

## Open

### [2026-05-04] Slice 8 Phase 5 dry-run #2 -- Resend webhook not arriving (Gate 17, second occurrence) -- root-caused to Resend dashboard config
- **Broken:** Second Phase 5 dry-run (`messages_log.id=12f42084-e6a6-4a70-8138-423a42aca2f9`, draft `36dabe15-68ac-4789-aec2-572c9e7a03ff`, sent 2026-05-04 06:47:50Z, `send_mode='both'`, Resend fallback id `5375f360-ced1-46fc-8efc-1da536cb5beb`) reproduced the Gate 17 deferral pattern. After ≥3 minutes post-send, zero `activity_events` rows with `verb LIKE 'email.%'` for this message and zero `error_logs` rows with `endpoint='/api/webhooks/resend'`. Step 18 inbox eyeball CONFIRMED via Gmail (thread `19df1be3f4833be0` arrived at alex@alexhollienco.com at 06:47:50Z, subject "The Weekly Edge -- Issue #19 -- May 4, 2026") so the send path is healthy end-to-end via Gmail; failure is purely the Resend webhook → activity_events join. **Root cause isolated:** `SELECT count(*) FROM message_events` returns 0 rows total, ever. No Resend webhook has ever successfully reached the handler and passed signature verification across the entire history of this Slice 5A → Slice 8 build. PR #26 Phase 5.7 `JSON.stringify` fix is not the bottleneck because the handler is never invoked.
- **Where:** Webhook handler at `src/app/api/webhooks/resend/route.ts:113-129` rejects requests with HTTP 401 + `{"error":"unauthorized"}` when `RESEND_WEBHOOK_SECRET` is missing, OR `{"error":"invalid signature"}` when `verifySvixSignature()` returns false. Neither path calls `logError`, so signature mismatches and missing-secret rejects produce zero rows in `error_logs` -- indistinguishable from "no request arrived at all." `RESEND_WEBHOOK_SECRET` IS set in Vercel Production+Preview+Development per `vercel env ls`. So either (a) endpoint not configured in Resend dashboard, (b) endpoint configured but disabled, (c) endpoint URL points to a stale Vercel preview hostname, or (d) Resend's signing secret value doesn't match the `RESEND_WEBHOOK_SECRET` env var in Vercel.
- **Fix needed (in order):** (1) Log into Resend dashboard → Webhooks. Verify an endpoint exists with URL `https://gat-bos.vercel.app/api/webhooks/resend` and status `Active`, subscribed to events `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`. (2) Compare Resend's signing secret against `vercel env pull --environment=production` value of `RESEND_WEBHOOK_SECRET` (will print the secret). If different, regenerate in Resend and `vercel env add RESEND_WEBHOOK_SECRET production`. (3) Click "Send test event" in Resend dashboard; within 1 minute confirm a `message_events` row appears OR a `error_logs` row with `endpoint='/api/webhooks/resend'` shows. (4) Re-verify Gate 17 against either the existing draft `36dabe15` send (Resend fallback id `5375f360-ced1-46fc-8efc-1da536cb5beb` -- the JSONB containment lookup at `route.ts:147-172` should resolve it) or wait for next live cron Tue May 5 20:00 UTC. (5) Move this entry to `## Resolved` once `message_events` has ≥1 row.
- **Structural follow-up:** SHIPPED 2026-05-04 via PR #31 (`17f1940`, `plumbing(webhook): log 401 paths to error_logs for diagnostic visibility`). `src/app/api/webhooks/resend/route.ts:115` and `:124` now call `logError(ROUTE, "RESEND_WEBHOOK_SECRET not configured" | "invalid svix signature", {reason, svix_id?, svix_timestamp?}, 401)`. Once the Resend dashboard is checked and a test event fires, expected outcome is one of: (a) `message_events` row appears (config OK -- close this blocker); (b) `error_logs` row with `reason=invalid_signature` (signing secret mismatch -- regenerate in Resend, then `vercel env add RESEND_WEBHOOK_SECRET production`); (c) still nothing in either table after dashboard test event (endpoint URL wrong or webhook disabled in Resend). Diagnosis time drops from "infer from absence" to "read one row".
- **Phase 5.8 prerequisite landed 2026-05-04:** PR #33 (`30b4e05`, `plumbing(slice-8 phase 5.8): error_logs.user_id NOT NULL -> NULLABLE`) drops `NOT NULL` on `error_logs.user_id` so the PR #31 breadcrumbs actually persist. The 401 paths fire BEFORE auth resolution, where `user_id DEFAULT auth.uid()` resolves to NULL and previously tripped the constraint -- silently dropping the breadcrumb that PR #31 was supposed to surface. Verification (`scripts/phase-5-8-verify.mjs` against prod) PASS 6/6: synthetic POST to `/api/webhooks/resend` produced `error_logs` row `4a648a62-f366-40d7-804a-9ee1c8c01f65` with `reason=invalid_signature`, `user_id=NULL`. Diagnostic blind spot now closed end-to-end.

### [2026-05-04] Slice 8 Phase 5 dry-run #2 -- Gate 14 UI Approve still silent-failing (Path A breadcrumbs not firing)
- **Broken:** Second Phase 5 dry-run on draft `36dabe15-68ac-4789-aec2-572c9e7a03ff`. After Alex clicked Approve on the `/drafts` UI Campaign tab, draft `status` stayed `pending_review` and `approved_at` stayed `null`. Zero `error_logs` rows with `endpoint='/api/campaigns/drafts'` post-click. Resolved by force-approve via psql (same workaround as 2026-05-03).
- **Where (two live hypotheses):**
  - **H1 -- client-side (original):** PATCH to `/api/campaigns/drafts` never dispatches. Possible causes: `onClick` not wired, `disabled` flag stuck, optimistic-mutation guard short-circuiting, wrong URL, or the response is masked (e.g. middleware redirects to `/login` HTML which `res.ok===true` lets through `patchCampaignDraft` at `src/components/drafts/campaign-drafts-view.tsx:50-64` because `res.json().catch(() => ({}))` swallows the parse error). NOTE: middleware at `src/middleware.ts:48` excludes `/api/*` from auth-redirect, so the `/login` masking sub-case is unlikely.
  - **H2 -- route-side silent early-exit (added 2026-05-04 post PR #31):** The PATCH does reach `src/app/api/campaigns/drafts/route.ts` but exits via one of FOUR paths that return non-2xx without writing `error_logs`: (a) `route.ts:39-46` -- `TenantResolutionError` → 401 silent; (b) `route.ts:48-53` -- `ctx.kind !== "user"` → 401 silent; (c) `route.ts:138-140` -- existing-row read error → 500 silent; (d) `route.ts:141-143` -- `!existing` (row gone or soft-deleted) → 404 silent. PR #29 Path A breadcrumbs (`route.ts:168-187` etc.) only fire on the UPDATE branches AFTER these gates pass. This is the same diagnostic blind spot that PR #31 just closed for the Resend webhook 401 paths.
- **Fix needed (parallel tracks):**
  1. **Devtools repro** (Alex-only): click Approve in `/drafts` Campaign tab, watch Network tab for the PATCH to `/api/campaigns/drafts` -- record the response status code and body. If 401 → H2 case (a) or (b). If 404 → H2 case (d). If 200 with `{ok:true}` but DB unchanged → bug in admin client / RLS interaction. If no network call fires → H1. Now also resolvable by reading `error_logs` post-click (see Track 2).
  2. **Structural plumbing PR (mirror PR #31):** SHIPPED 2026-05-04 via PR #32 (`b159023`, `plumbing(drafts-route): log silent 401/404/500 paths to error_logs`). All four silent early-exit paths in `src/app/api/campaigns/drafts/route.ts` now call `logError(ROUTE, ...)` with a `reason` context field naming the path: `tenant_resolution_error` (case a, 401), `tenant_not_user` (case b, 401), `draft_read_error` (case c, 500), `draft_not_found` (case d, 404). Scope: 1 file, +22/-0. Diagnosis time on next silent failure drops from "infer from absence" to "read one row." Tue May 5 20:00 UTC cron remains the natural happy-path verification window -- expected outcome: zero `error_logs` rows for `endpoint=/api/campaigns/drafts` on the Approve click; any silent failure now produces a row whose `reason` immediately disambiguates H1 vs H2 case.
  3. **Phase 5.8 prerequisite landed 2026-05-04:** PR #33 (`30b4e05`, `plumbing(slice-8 phase 5.8): error_logs.user_id NOT NULL -> NULLABLE`) drops `NOT NULL` on `error_logs.user_id` so the PR #32 breadcrumbs actually persist. The four silent early-exit paths fire BEFORE auth resolution, where `user_id DEFAULT auth.uid()` resolves to NULL and previously tripped the constraint -- silently dropping the breadcrumbs that PR #32 was supposed to surface. Verification (`scripts/phase-5-8-verify.mjs` against prod) PASS 6/6: synthetic PATCH to `/api/campaigns/drafts` with no auth cookie produced `error_logs` row `403f8608-0e19-4e86-bd1c-26f69b5a8bbb` with `reason=tenant_resolution_error`, `user_id=NULL`. Diagnostic blind spot now closed end-to-end. On Tue May 5 20:00 UTC cron, any Gate 14 silent failure will produce a persistent breadcrumb.

### [2026-05-03] ALTOS_API_KEY not provisioned (Slice 8 Phase 2 Altos pull cron)
- **Broken:** `/api/cron/altos-pull` runs but `fetchAltosSnapshot` returns `{ status: "pending_credentials" }` because `ALTOS_API_KEY` is not yet set in Vercel env. Cron still upserts a `weekly_snapshot` row per tracked market with the placeholder `data` shape so downstream phases (writer, assembly) have a row to read; reviewers will see "pending_credentials" in the rendered draft and reject before send.
- **Where:** `src/lib/altos/client.ts` -- `altosCredentialsAvailable()` gate at top of `fetchAltosSnapshot`. Real Altos HTTP call is the TODO inside that function.
- **Fix needed:** (1) Provision Altos Research API key + endpoint URL. (2) Set `ALTOS_API_KEY` (and any sibling vars) in Vercel preview + production via `vercel env add`. (3) Implement the real fetch in `fetchAltosSnapshot` using `market.altos.zip` + `market.altos.propertyType` from `TRACKED_MARKETS`. (4) Remove or downgrade this BLOCKERS entry. Slice 8 Phases 3-5 can proceed against the placeholder shape until then.

### [2026-05-02] Portal-read RPC layer not yet built (Slice 7C dashboard data sections)
- **Broken:** `/portal/[slug]/dashboard` ships with empty-state cards for touchpoints, messages, and upcoming events. The underlying tables (`project_touchpoints`, `messages_log`, `events`) are gated by 7B account-scoping RLS to the account owner (Alex). The agent's authenticated portal session cannot read them directly.
- **Where:** `src/app/portal/[slug]/dashboard/page.tsx` (Slice 7C Task 4a). Sections render hard-coded empty states.
- **Fix needed:** Add three SECURITY DEFINER RPCs scoped to the calling auth.uid() -> contacts.id -> account_id binding: `get_portal_touchpoints(p_slug)`, `get_portal_messages(p_slug)`, `get_portal_upcoming_events(p_slug)`. Each returns rows filtered to the agent's contact_id. Wire into the dashboard page sections. Likely Slice 7D or a follow-up Slice 7C.5.

### [2026-04-25] Slice 3 W3 backfill duplicate interaction.backfilled rows
- **Broken:** Slice 3 W3 backfill discovered 2 pre-existing `interaction.backfilled` rows from Slice 1 backfill (legacy_id=null). Slice 3 backfill created duplicates with legacy_id populated because the `WHERE NOT EXISTS` clause on `context->>'legacy_id'` couldn't match against null. Resolved by soft-deleting the newer Slice 3 rows. Older Slice 1 rows preserved due to potential downstream UUID references.
- **Where:** `activity_events` rows with `verb='interaction.backfilled'` AND `deleted_at IS NOT NULL`. Soft-deleted IDs: `1f376e8c-7d5e-4ef7-be15-06ee31a87681`, `e0c895bb-9070-45ed-a12b-145c04693a0e`.
- **Fix needed:** None required. Future: if anyone investigates `interaction.backfilled WHERE deleted_at IS NOT NULL`, these are the 2 known soft-deletes -- not a data integrity issue.

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

### [2026-04-23] captures-audio lifecycle: cleanup cron not wired -- RESOLVED 2026-05-03
- Resolution: `vercel.json` crons array gained one entry `{ "path": "/api/captures/cleanup-audio", "schedule": "0 12 * * *" }`. Route already existed at `src/app/api/captures/cleanup-audio/route.ts` (30-day retention, `verifyCronSecret`-gated, runtime nodejs). `CRON_SECRET` already provisioned in Vercel preview + production for Slice 8 Phase 5; same secret guards this route.
- Closing PR: #30 (this commit). Post-merge gate: `vercel cron ls` against next prod deploy must show `/api/captures/cleanup-audio` in output.

### [2026-05-03] Campaign drafts Approve button click does not commit (Slice 8 Phase 5 Gate 14) -- RESOLVED 2026-05-03 (Path A patch)
- Resolution: All 3 PATCH UPDATE branches in `src/app/api/campaigns/drafts/route.ts` (`approve` / `reject` / `edit_html`) now chain `.select("id")` after `.eq("id", body.id)` so supabase-js returns rows actually written. New `logError(ROUTE, ...)` breadcrumbs to `error_logs` on update error AND on 0-row match. 0-row match now returns HTTP 409 with explicit message (was previously silent 200 because the original update returned `{ error: null }` without surfacing that 0 rows were affected -- exactly the silent-failure path that hit draft `836e2cca-1862-46ef-86ee-5b8e1912d94a` during Phase 5 dry-run).
- Closing commit: `c67f3d3` (PR #29, squash-merged via `CLAUDE_AUTOMATION_PR_MERGE=29` bypass per AI_AGENT_OPERATING_MODEL.md Section 13). Verified `pnpm typecheck` PASS + `pnpm build` PASS pre-merge; Vercel preview SUCCESS at merge time.
- Live verification deferred: next Approve click on a `pending_review` draft should flip to `status='approved'` with no `error_logs` row on the success path; synthetic 409 path (Approve a draft already in `approved` status) should append a row to `error_logs` with `endpoint=/api/campaigns/drafts`, `error_message='approve update matched 0 rows'`, and `prior_status` context.
- **Verification window pinned (Option C, 2026-05-03):** happy-path Approve verification rides alongside Gate 17 end-to-end at the next live Weekly Edge cron, **Tue May 5 20:00 UTC = Tue May 5 1pm MST** (`/api/cron/weekly-edge-send` `0 20 * * 2`). Per `~/crm/.planning/phases/021-slice-8-phase-5-cron-registration-dry-run/PLAN.md` Gate 14, click Approve on the `pending_review` draft generated by Tue May 5 18:00 UTC assemble cron, then confirm `status='approved'` + `approved_at` populated + zero `error_logs` rows for endpoint `/api/campaigns/drafts` in the click window. Synthetic 409 (re-Approve an already-approved draft) is optional follow-up, not part of the May 5 window. No standalone repro session needed.

### [2026-04-27] Six non-conforming migration filenames silently skipped by Supabase CLI -- RESOLVED 2026-05-03 (plumbing audit closure)
- Resolution: Verified 2026-05-03 during system-wide audit pre-flight (`supabase migration list --linked`): all six previously-flagged filenames (`phase-1.3.1-gmail-mvp.sql`, `phase-1.3.2-observation.sql`, `phase-1.4-projects.sql`, `phase-1.5-calendar.sql`, `phase-9-realtime-email-drafts.sql`, `slice-2a-drop-spine.sql`) are already renamed to compliant `<14-digit-timestamp>_<name>.sql` format (timestamps `20260407013000`-`20260407013050` plus `20260410000100`) and registered Local==Remote. Audit Y5 prescription was based on stale BLOCKERS.md state from 2026-04-27 -- the rename had already landed in an earlier session. No `supabase migration repair` invocation was required. Closure-only entry; no commit on the rename itself.
- Closing PR: this plumbing PR (Y4 root-docs commit + Y5 closure-only). Source plan: `~/.claude/plans/2026-05-03-root-docs-plumbing-pr.md`.

### [2026-05-03] Phase 5.6 webhook fix shipped but `.contains()` call serializes wrong -- RESOLVED 2026-05-03 (Slice 8 Phase 5.7)
- Resolution: Wrapped the `.contains("event_sequence", [...])` argument in `JSON.stringify(...)` at `src/app/api/webhooks/resend/route.ts:159-169` so supabase-js sends the wire format `cs.[{...}]` (a JSON literal PostgREST accepts) instead of `cs.{...}` (a Postgres array literal that triggered `22P02 invalid input syntax for type json` on every webhook hit).
- Smoke test landed alongside the fix at `scripts/phase-021-gate-17-jsonb-fallback-smoke.mjs`. It exercises the exact `.contains()` shape against the Phase 5 dry-run row (messages_log `bbd25ec5-...`, Resend fallback ID `08309aa6-...`) and asserts the row resolves cleanly. Verified locally pre-merge: PASS, returned the expected row id. Halt conditions cover the 22P02 regression surface, soft-delete drift, and wrong-row matches.
- Closing commit: `9afbc93` (PR #26, squash-merged via `CLAUDE_AUTOMATION_PR_MERGE=26` bypass per AI_AGENT_OPERATING_MODEL.md Section 13). Plan: `~/crm/.planning/phases/021-slice-8-phase-5-cron-registration-dry-run/PLAN.md` Phase 5.6 carried-forward regression entry.

### [2026-05-03] Resend webhook lookup misses send_mode='both' rows -- RESOLVED 2026-05-03 (Slice 8 Phase 5.6)
- Resolution: Webhook handler now falls back to a JSONB containment query against `event_sequence` when the primary `provider_message_id` lookup misses. Pattern: query `messages_log` rows where `event_sequence @> '[{"event":"sent","payload":{"fallback_message_id":"<id>"}}]'`. This is option (a) from the original entry (lowest blast radius, no schema migration). The `dry-run-alex` resolver and the `send_mode='both'` semantics are unchanged; the handler is the only thing that learned the new lookup path.
- Closing commit: `5c6e1ea` (PR #25, squash-merged via `CLAUDE_AUTOMATION_PR_MERGE=25` bypass per AI_AGENT_OPERATING_MODEL.md Section 13). Plan: `~/crm/.planning/phases/021-slice-8-phase-5-cron-registration-dry-run/PLAN.md`.
- **Carried-forward regression:** Verification post-deploy revealed the `.contains()` call in the new fallback serializes as a Postgres array literal instead of a JSON literal, so PostgREST rejects every webhook hit with `22P02 invalid input syntax for type json`. Tracked as the new `## Open` entry "Phase 5.6 webhook fix shipped but `.contains()` call serializes wrong" -- one-line `JSON.stringify` wrap pending Phase 5.7.

### [2026-05-03] weekly_snapshot upsert fails: ON CONFLICT vs partial unique index -- RESOLVED 2026-05-03 (Slice 8 Phase 5.5)
- Resolution: Replaced the `.upsert(... { onConflict: "week_of,market_slug" })` call in `src/app/api/cron/altos-pull/route.ts` `pullOne()` with an explicit SELECT (filtering `deleted_at IS NULL`) then UPDATE on hit / INSERT on miss. Partial unique index `weekly_snapshot_week_market_uniq ... WHERE deleted_at IS NULL` preserved by design (soft-delete-and-repull semantic per Standing Rule 3 still intact). No schema migration.
- Verified live on prod: gate 11 of Phase 021 PLAN.md `curl -H "Authorization: Bearer $CRON_SECRET" https://gat-bos.vercel.app/api/cron/altos-pull` returned `{"ok":true,"upserted":1,"failed":0}` with snapshot row `4e635dd8-3f4c-4b6e-8029-a6fe6190be76` for ISO Monday 2026-04-27.
- Closing commit: `2b04beb` (PR #23, squash-merged via `CLAUDE_AUTOMATION_PR_MERGE=23` bypass per AI_AGENT_OPERATING_MODEL.md Section 13). Plan: `~/crm/.planning/phases/022-slice-8-phase-5-5-altos-pull-upsert-fix/PLAN.md`.

### [2026-04-21] `contacts` table missing `slug`, `photo_url`, `tagline` columns -- RESOLVED 2026-05-01 (Slice 7B)
- Resolution: Slice 7B Task 1 added `slug text` (UNIQUE per account via partial index `contacts_account_slug_unique`), `tagline text`, and `account_id uuid` (FK accounts on DELETE RESTRICT). `photo_url` was NOT added -- Q-drift-2 resolved per Standing Rule 16 in favor of the existing `headshot_url` column (same concept, codebase wins). Task 1 also extended `contacts_type_check` with `'agent'` (12th sanctioned classification) and `'escrow'` (fold-in: 10 prod rows already used `type='escrow'`, surfaced by constraint-rebuild row-level revalidation).
- Anon read mechanism resolved per Q2 = security-definer RPCs: `get_public_agent_slugs()` returns the 5 seeded slugs; `get_public_agent_by_slug(text)` returns whitelisted columns only (slug, first_name, last_name, brokerage, title, headshot_url, website_url, tagline; 31 private columns rejected by harness). `/agents/[slug]` route at `src/app/agents/[slug]/page.tsx` now reads from the RPC instead of the hardcoded `AGENTS` const.
- Closing commits: `4ffc3fc` (Task 1 schema delta + RLS rewrite), `3b1114a` + `4adc707` (Task 3 seed + Path A upsert-by-email amendment), `0fadd71` (Task 5 RPCs), `80d1417` (Task 4 route refactor), `4adc707` (Task 6 smoke harness `scripts/slice7b-smoke.mjs`). Smoke harness Layers 1+2 = 10/10 green against local Docker; Layer 3 (HTTP route) deferred to post-prod-deploy verification per Path A decision.

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
