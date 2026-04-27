## LATER.md

Follow-ups deferred out of the current slice. Each entry: date logged, source slice, what to do, file/line(s) involved, why it was deferred. Promote to a real BLOCKERS.md entry only when it becomes blocking.

---

## Open

### [2026-04-26] (Phase 008) De-duplicate CADENCE map after dddc0b0 lands post-Slice 4
- **Where:** `src/app/(app)/today-v2/queries.ts:31` carries an inline `const CADENCE: Record<Tier, number> = { A: 5, B: 10, C: 14 }` with a leading comment that the canonical source is `src/lib/scoring/temperature.ts`.
- **What:** Once Morning Brief Phase 1 commit `dddc0b0` (parked at the tip of `gsd/006-slice-3a-route-thinning-lib-standardization`) lands on main post-Slice 4, delete the inline `CADENCE` const and replace with `import { CADENCE } from '@/lib/scoring/temperature'`. Verify both `useCallsLane` and any future callers stay in sync with the canonical map.
- **Why deferred:** Cherry-picking `temperature.ts` from `dddc0b0` onto Phase 008 risks dragging in fragments of the deferred Morning Brief consumer route without its 4 sibling files. Plan 008 Decision 2a chose the duplication explicitly.

### [2026-04-26] (Phase 008 -> 009) Wire mutations + plan /today -> /today-v2 cutover
- **Where:** `/today-v2` reads only as of Phase 008. Mutation surface area: runway item check-off persistence, listing-activity check-off persistence, moments snooze, calls-lane "mark called", any other state currently held in client-only React state.
- **What:** Phase 009 scope. Add mutation API routes under `/api/today-v2/*` (or extend existing endpoints), expand Realtime subscriptions beyond `email_drafts` (projects, project_touchpoints, activity_events) once the latency profile is understood, then choose and execute the /today -> /today-v2 cutover (replace, A/B, or sunset old). Mobile responsive pass on the 3-column layout also lives in this phase.
- **Why deferred:** Phase 008 was scoped as ratification + read-only ship; mutations multiply the test surface and the cutover decision needs its own plan.

### [2026-04-27] (Slice 4) Migrate /api/email/approve-and-send to call sendMessage()
- **Where:** `src/app/api/email/approve-and-send/route.ts` calls `sendDraft` from `src/lib/resend/client.ts` directly. The new `sendMessage()` abstraction at `src/lib/messaging/send.ts` is the canonical send path going forward.
- **What:** Replace the direct `sendDraft` call with a `sendMessage({ templateSlug: '<draft-slug>', recipient, mode: 'resend', variables })` call. Requires either creating a per-draft template row or extending `sendMessage()` to accept inline body for ad-hoc drafts. Decide pattern at start of work; ad-hoc is simpler v1.
- **Why deferred:** Slice 4 sets up the abstraction surface; touching the live approve-and-send path would have widened the slice diff and increased regression risk on the production-critical email send. Logged for Slice 5A or 5B.

### [2026-04-27] (Slice 4) Explicit drop of activities.request_id column
- **Where:** `public.activities.request_id` column. The inbound FK was cleared by `DROP TABLE _deprecated_requests CASCADE` in Slice 4 Task 9, but the column itself remains (0 non-null rows confirmed pre-drop).
- **What:** `ALTER TABLE public.activities DROP COLUMN request_id;` -- mechanical, no live writers in current code. Pair with a SCHEMA.md note.
- **Why deferred:** Out of Slice 4 scope; column-drop should happen in a small dedicated cleanup step, not as a side-effect of the table-drop migration.

### [2026-04-27] (Slice 4) Weekly Edge font-stack reconciliation vs brand.md Email = Kit 1
- **Where:** `public.templates` row `slug='weekly-edge'`, version=1. The seed body_html ships with Syne + Playfair Display + Inter + Space Mono (newsletter-aesthetic screen-tier pairing carried in from the canonical eval-output).
- **What:** Brand.md "Font Stack Per Format" table mandates Email = Kit 1 (Instrument Serif + Inter, Google Fonts only). Decide whether to (a) bump the Weekly Edge to version=2 with a Kit-1-conformant body, treating the newsletter as a screen-tier exception logged in brand-reference.md, or (b) keep eval-output verbatim as the canonical Weekly Edge brand and update brand.md to reflect the newsletter exception. Either path works; pick one and ship.
- **Why deferred:** Q1 of the Slice 4 protocol explicitly chose eval-output verbatim; reconciling the brand-stack mandate is a separate decision that warrants its own discussion with Alex.

### [2026-04-26] (Slice 3B) Per-provider OAuth state-signing keys when non-Google providers arrive
- **Where:** `src/lib/gmail/oauth.ts` (currently a single combined Gmail+Calendar Google flow per `GMAIL_SCOPES` union at lines 13-17).
- **What:** When Outlook / Apple Calendar / any non-Google provider is added, introduce `OAUTH_STATE_SIGNING_KEY_<PROVIDER>` per-provider keys so a leaked signing key in one provider's flow doesn't cross-contaminate others.
- **Why deferred:** Today's single-key approach is correct for the single combined Google flow; per-provider split is premature without a second provider to contrast against.

### [2026-04-26] (Slice 3B) Migrate `@/components/materials/*` to `@/components/tickets/*`
- **Where:** `src/components/materials/material-request-row.tsx`, `src/components/materials/material-request-form.tsx` (and their import sites).
- **What:** Rename the directory + the two component files (`material-request-row.tsx` -> `ticket-row.tsx`, `material-request-form.tsx` -> `ticket-form.tsx`) and update all imports. Component naming drift is a source of future grep confusion now that the route is `/tickets` and the table is `tickets`.
- **Why deferred:** Slice 3B scope was DB + route + lib + OAuth; component naming was an explicit out-of-scope per starter to keep the diff focused.

### [2026-04-26] (Slice 3B) Rename `MaterialRequest*` types and identifiers to `Ticket*`
- **Where:** `src/app/(app)/tickets/[id]/actions.ts` (`MaterialRequestStatus` type alias), and any `MaterialRequest*` type/component identifiers across `src/`.
- **What:** Rename to `Ticket*` for consistency with the renamed table. Type rename is mechanical -- no behavior change.
- **Why deferred:** Out of scope per starter; bundling with the components/materials directory rename above would make a single clean follow-up slice.

### [2026-04-26] (Slice 3B) Rename `material_requests_contact_id_fkey` -> `tickets_contact_id_fkey` (cosmetic)
- **Where:** `public.tickets` constraint (still named `material_requests_contact_id_fkey` after the table rename; FK target `contacts.id`).
- **What:** `ALTER TABLE public.tickets RENAME CONSTRAINT material_requests_contact_id_fkey TO tickets_contact_id_fkey;`
- **Why deferred:** Decision-2 in Slice 3B scoped cosmetic renames to indexes + triggers + RLS policies, not FK constraint names. Cosmetic only -- the constraint works either way (regclass-based).

### [2026-04-26] (Slice 3B / Slice 4 follow-up) Migrate /api/inbox/scan to oauth_tokens-backed sync client
- **Where:** `src/app/api/inbox/scan/route.ts:47` (calls `fetchUnreadThreads` from `src/lib/gmail/client.ts`, which reads `process.env.GOOGLE_REFRESH_TOKEN`).
- **What:** Refactor scan route to use `loadTokens()` + `getOAuth2Client()` from `src/lib/gmail/oauth.ts` (already wired for the combined Gmail+Calendar scope), then remove `GOOGLE_REFRESH_TOKEN` from `.env.local` + Vercel envs + `.env.example`. New flow exists at `src/lib/gmail/sync-client.ts` reading from `oauth_tokens`; `client.ts` comment confirms it's "legacy still in use."
- **Why deferred:** One live caller exists, so removing the env var would break inbox sync. Scope creep for Slice 3B; cleaner as a dedicated Slice 4 task.

### [2026-04-26] (Off-plan / pre-Slice-3B) Merge Morning Relationship Brief Phase 1 (commit `dddc0b0`)
- **Where:** Branch `gsd/006-slice-3a-route-thinning-lib-standardization` (local + `origin/gsd/006-...`), tip commit `dddc0b0` ("feat: Morning Relationship Brief Phase 1 (overnight agent)"). 15 files / 1104 insertions: `src/app/(app)/morning/{page,morning-client}.tsx`, `src/app/api/cron/morning-brief/route.ts`, `src/app/api/morning/latest/route.ts`, `src/lib/scoring/temperature.ts`, `src/lib/claude/brief-client.ts`, `supabase/migrations/20260425130000_morning_briefs.sql`, `vercel.json` cron entry `30 12 * * *`, plus 7 `scripts/morning-*` and `scripts/probe-*` debug helpers. Documented in STATUS.md 2026-04-25.
- **What:** Resume in a dedicated session AFTER Slice 4 ships. Required steps when revived:
  1. Rebase `gsd/006` onto current `main` (post-Slice-3B). Expect conflicts in: `src/lib/captures/parse.ts` (renamed to `rules.ts` in 3B Task 6a), `src/lib/captures/promote.ts` (folded into `actions.ts` in 3B Task 6b), `src/lib/campaigns/auto-enroll.ts` (folded into `actions.ts` in 3B Task 6c), `src/lib/events/invite-templates/` (collapsed to single `.ts` file in 3B Task 6d). The Morning Brief feature itself touches none of these directly, but transitive imports may surface mismatches.
  2. Verify imports against Slice 3B's lib reorganization; audit `src/lib/scoring/temperature.ts` and `src/lib/claude/brief-client.ts` for any captures/campaigns/events references.
  3. Dry run: `cd ~/crm && pnpm typecheck && pnpm build`.
  4. Smoke test `/morning` route load + cron round-trip via curl against `/api/cron/morning-brief`.
  5. Open a focused PR (Phase 1 only; Phase 2 - MLS event detection, congratulations queue, SMS/Twilio, push notifications, /morning interactive actions, cross-day trend - explicitly deferred).
- **Why deferred:** Phase 1 was off-plan feature work, not part of the 15-slice restructure. PR #5 (Slice 3A) merged `d164f4c` to main at `ac716a7`, stopping one commit shy of `dddc0b0`. Slice 3B did not touch it. Slice 4 will rework templates/messaging surface that Morning Brief depends on; merging Phase 1 BEFORE Slice 4 forces Slice 4 to plan around it; merging AFTER lets Slice 4 integrate cleanly. Work is preserved on `origin/gsd/006-...` -- no risk of loss; local branch + remote branch both retained.

### [2026-04-26] (Slice 3A carryforward) Archive Slice 3A rate-limit-rpc paste-file
- **Where:** `~/Desktop/PASTE-INTO-SUPABASE-rate-limit-rpc.sql` (still on Desktop per BUILD.md Slice 3A note; smoke deferred until paste lands).
- **What:** Once Alex pastes the RPC and runs the live smoke (`pnpm dev` + 11x `/api/intake` POST to confirm 429), move the file to `~/Archive/paste-files/2026-04/` per Standing Rule 22.
- **Why deferred:** Out of Slice 3B scope; flagged in the Slice 3B risk register row #7.

### [2026-04-26] (Practice rule, post-incident) Backfill migrations must assert source row count before any DROP TABLE step in the same sequence
- **Where:** Any future `~/crm/supabase/migrations/*_backfill_*.sql` that is followed by a `DROP TABLE legacy_*` step in the same slice.
- **What:** The backfill SQL must `RAISE EXCEPTION` if the source table's row count is below an explicit minimum confirmed at draft time. Pattern: `SELECT COUNT(*) INTO v_src FROM legacy_x; IF v_src < <expected> THEN RAISE EXCEPTION 'Source drift: expected >= % rows in legacy_x, found %. Investigate before continuing.', <expected>, v_src; END IF;` This is a hard gate, not a warning -- the next step in the sequence drops the source, so a silent empty backfill is unrecoverable.
- **Why:** The 2026-04-25 morning brief returned `effective_drift=1000` for all 103 A/B/C contacts. Root cause: `20260425110000_slice3_legacy_backfill.sql` ran against an `interactions_legacy` table that held =<4 rows at execution time; `20260425120000_slice3_view_rewrite_drop_legacy.sql` then dropped the table. The 78 contacts whose history lived in `contacts.last_touchpoint` (denormalized field, never copied to legacy) were silently lost from the activity ledger. Replacement migration `20260426120000_backfill_last_touchpoint_to_activity_events.sql` demonstrates the pattern: source-count assertion fails loudly if state has drifted from the authored expectation.

---

## Done

(Items move here once executed, with date + closing commit/PR.)
