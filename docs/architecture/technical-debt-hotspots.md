# Technical Debt Hotspots -- GAT-BOS CRM

## Context

This document classifies discovered debt by severity and area. It is the output of a read-only architecture pass; **no fixes are applied**. The repo is mid-flight on Slice 7A.5 (Migration History Reconciliation), and any issue found inside the auth / RLS / tenant / migrations / captures / activity_events / rate-limit / AI-budget perimeter is documented with a **DO NOT AUTO-FIX** banner. Alex triages.

Severity legend:

| Level | Meaning |
|---|---|
| **P0** | Production-correctness or security-adjacent. Touch only with explicit Alex approval. |
| **P1** | Correctness or stability risk on a non-auth surface. Schedulable for a plumbing slice. |
| **P2** | Refactor opportunity or clarity gain. Not blocking; improves maintainability. |
| **P3** | Cosmetic, dead code, or hygiene. Punch-list item. |

For each item: location, evidence, risk, recommended treatment, and a routing note.

---

## P0 -- 7A.5 perimeter (DO NOT AUTO-FIX)

These items either sit inside the active 7A.5 reconciliation work or touch the auth / RLS / tenant boundary. Document them, surface to Alex, never auto-fix in this pass.

### P0-1. BLOCKERS.md "6 non-conforming migrations" entry may be stale

**Banner:** DO NOT AUTO-FIX -- DEFER TO ALEX (Slice 7A.5 territory).

**Location:** `~/crm/BLOCKERS.md` open entry dated 2026-04-27.

**Evidence:** BLOCKERS.md says six legacy filenames (`phase-1.3.1-gmail-mvp.sql`, `phase-1.3.2-observation.sql`, `phase-1.4-projects.sql`, `phase-1.5-calendar.sql`, `phase-9-realtime-email-drafts.sql`, `slice-2a-drop-spine.sql`) skip the CLI's pattern match. **Verified 2026-05-01 via `ls supabase/migrations/ | grep -vE '^[0-9]{14}_'` -- 0 files match.** All 91 migrations conform to the `<14-digit-timestamp>_<name>.sql` pattern.

**Risk:** BLOCKERS.md "Open" entry is misleading future agents into thinking work remains. Slice 7A.5 likely renamed them already.

**Recommended treatment:** Alex confirms whether 7A.5 closed this. If yes, move BLOCKERS entry to `## Resolved`. Do not modify migrations directly.

**Routing:** include in Alex's morning handoff notes.

### P0-2. `email_drafts.expires_at` lifecycle assumes 72h drift safety

**Banner:** DO NOT AUTO-FIX -- DEFER TO ALEX.

**Location:** `src/app/api/email/approve-and-send/route.ts:179` (rejects drafts where `expires_at < now()`), `src/app/api/email/generate-draft/route.ts` (sets `expires_at = now+72h`).

**Evidence:** Drafts auto-expire 72 hours after generation. If Alex doesn't process a draft in 72 hours, the queue drops it. There's no ranking signal between "generated 2 hours ago" and "generated 71 hours ago" beyond the countdown.

**Risk:** Bursty Gmail volumes can produce more drafts than Alex can process in three days. Drafts expire silently (no notification path verified). The countdown UI is the only visibility.

**Recommended treatment:** Alex audits one week of expired drafts to see how many slip. If volume is non-trivial, add a "stale draft" notification before expiry. This touches the in-flight phases 1.3.2-D observation window and is owned by that work; do not auto-fix.

**Routing:** flag to Alex; no immediate code change.

### P0-3. Service-role callers must scope rows manually -- no static check

**Banner:** DO NOT AUTO-FIX. Convention only.

**Location:** every file using `import { adminClient }` (16 sites per dependency-analysis.md section 6).

**Evidence:** `tenantFromRequest` returns `{kind:'service'}` with no `accountId`. Service-role clients bypass RLS. Callers must filter `.eq('user_id', userId)` or `.eq('account_id', accountId)` manually. There's no compile-time enforcement; it's a code-review convention.

**Risk:** A future contributor (or future Claude) could add a service-path query without the explicit scope and silently return rows from another tenant once the system has a second account. Today, there's only one account, so the bug would not surface until multi-tenant goes live.

**Recommended treatment:** A lint rule flagging `adminClient.from(...)` chains that don't include `.eq('user_id', ...)` or `.eq('account_id', ...)` would catch this at PR time. Defer the implementation; do not auto-write a lint rule in this pass.

**Routing:** logged to BACKLOG.md candidate, "RLS scope lint rule." Not urgent while single-tenant. Documented in `auth-flow.md` section 6.

### P0-4. `oauth_tokens` is the durable refresh-token store; encryption keys split between two purposes

**Banner:** DO NOT AUTO-FIX -- crypto perimeter.

**Location:** `src/lib/crypto/vault.ts` (AES-GCM encryption with `OAUTH_ENCRYPTION_KEY`), `src/lib/gmail/oauth.ts` (state nonce HMAC with `OAUTH_STATE_SIGNING_KEY`).

**Evidence:** Slice 3B introduced `OAUTH_STATE_SIGNING_KEY` to split state-nonce signing from at-rest token encryption. There was a one-slice fallback (state-signing falls back to `OAUTH_ENCRYPTION_KEY` if the new key is unset). Slice 4 retired the fallback (per BUILD.md 2026-04-27 entry). If `.env.local` or any deployment env is missing `OAUTH_STATE_SIGNING_KEY`, OAuth flows fail at the consent callback.

**Risk:** Env-var drift between local / preview / production. Alex must confirm presence in all three.

**Recommended treatment:** Alex audits Vercel env panel for both keys in preview and production. Do not modify crypto code in this pass.

**Routing:** include in Alex's morning checklist.

### P0-5. `RESEND_WEBHOOK_SECRET` may not be set in all envs

**Banner:** DO NOT AUTO-FIX. Verify only.

**Location:** `src/app/api/webhooks/resend/route.ts` (Svix HMAC verify reads `RESEND_WEBHOOK_SECRET`).

**Evidence:** Per ROADMAP.md and project memory, the webhook integration shipped 2026-04-19 (Phase 8). The secret is required for HMAC verification.

**Risk:** Missing secret in any env returns 401 to Resend, dropping delivery / open / click events silently. Alex would observe stale `messages_log.status` and missing health-score bumps.

**Recommended treatment:** Alex confirms env presence. No code change.

**Routing:** Alex's morning check.

### P0-6. Service-role callers writing to `activity_events` -- userId is required input but not validated

**Banner:** DO NOT AUTO-FIX. Convention.

**Location:** `src/lib/activity/writeEvent.ts` (Slice 7A hard-break).

**Evidence:** `writeEvent({userId, actorId, verb, object, context})` requires `userId`. There's no Zod / runtime check. Passing an empty string or a UUID belonging to a different account would write a misattributed row.

**Risk:** A bug in a caller (forgetting to derive userId from the row) misroutes events. RLS prevents external read of those rows but the local accounting is still wrong.

**Recommended treatment:** Add a Zod schema in `writeEvent` that validates uuid format. Defer; the cost of getting it wrong today is low (single tenant), and adding validation needs careful test coverage.

**Routing:** P0 because it touches the activity ledger. Ship in next plumbing slice with explicit Alex go-ahead.

### P0-7. AI budget guard fail-open on RPC error

**Banner:** DO NOT AUTO-FIX.

**Location:** `src/lib/ai/_budget.ts:60` -- `if (error) { await logError(...); }` then `spent_usd = error ? 0 : Number(data ?? 0)`.

**Evidence:** If `current_day_ai_spend_usd` RPC fails, `_budget.checkBudget` treats spent as $0. The Anthropic call proceeds. Soft cap and hard cap will not fire.

**Risk:** A persistent RPC failure during a high-volume burst could exceed the daily budget without firing the warning event. Cost overrun is real but bounded by Anthropic's own per-key rate limits.

**Recommended treatment:** Either fail-closed (block calls when RPC errors) or alert via a separate channel. Today's fail-open is intentional per the CRM availability stance, but worth Alex's review.

**Routing:** flag for Alex's review. No code change.

---

## P1 -- correctness, non-auth

### P1-1. `captures-audio` cleanup cron not wired

**Location:** `vercel.json` (no entry for `/api/captures/cleanup-audio`).

**Evidence:** Route exists at `src/app/api/captures/cleanup-audio/route.ts` and deletes Storage objects older than 30 days. Not scheduled.

**Risk:** Audio files accumulate in Supabase Storage indefinitely. Storage cost + privacy surface (voice memos retained beyond intent).

**Recommended treatment:** Add `{ "path": "/api/captures/cleanup-audio", "schedule": "0 12 * * *" }` to `vercel.json`. Confirm `CRON_SECRET` is set. One-line change.

**Routing:** flagged in BLOCKERS.md (2026-04-23). Schedulable next plumbing pass.

### P1-2. Five today-page widgets deleted in Slice 2A; rebuild is overdue

**Location:** `src/app/(app)/today/today-client.tsx`.

**Evidence:** Slice 2A deleted `tier-alerts.tsx`, `overdue-commitments.tsx`, `today-focus.tsx`, `recent-captures.tsx`, `week-stats.tsx` because they read from spine tables. The today page is sparse pending Slice 2B rebuilds.

**Risk:** Operator-facing UX gap. Today page (the canonical morning surface) shows fewer signals than before. Migration to `activity_events` is straightforward but unstarted.

**Recommended treatment:** A 1-2 day plumbing slice that rewrites the five widgets against `activity_events` reads. Schemas are stable; no migration risk.

**Routing:** five BLOCKERS entries dated 2026-04-23. Cluster as a Slice 2B follow-up.

### P1-3. Resend webhook does not rate-limit

**Location:** `src/app/api/webhooks/resend/route.ts`.

**Evidence:** Per Slice 3A decision documented in BUILD.md, the webhook intentionally has no rate limit (Svix HMAC IS the boundary). Inbound bursts from normal Resend activity should not be limited.

**Risk:** A misconfigured Resend webhook config (replays, duplicate posts) could spam `message_events` rows. The HMAC + `Svix-Id` pair gives idempotency room, but the route does not currently dedupe on Svix-Id.

**Recommended treatment:** Add a `unique(svix_id)` index on `message_events` and dedupe inserts. Low-effort safety net.

**Routing:** P1 because it's idempotency-adjacent. Slice 5A or successor.

### P1-4. Inline contact picker missing for capture promotion

**Location:** `src/lib/captures/actions.ts:71-77` (400 guard).

**Evidence:** When `parsed_intent` is `interaction`/`note`/`follow_up` but the rule parser didn't match a contact, the route rejects with 400 "Needs a contact" and the UI shows a disabled "Needs contact" pill. No inline affordance to assign a contact.

**Risk:** Operator friction: Alex must stop, mark stuck, and re-capture with a parser-recognized name. Captures pile up unprocessable.

**Recommended treatment:** Add a contact-search popover (cmdk, same pattern as Cmd+K) that writes `captures.parsed_contact_id` and re-enables Process. PATCH `/api/captures/[id]` route or reuse capture-update logic. Documented in BLOCKERS.md (2026-04-22).

**Routing:** Schedulable.

### P1-5. Captures table has no edit-after-submit affordance

**Location:** `src/app/(app)/captures/captures-client.tsx`.

**Evidence:** Captures are immutable by design for v1. Fat-finger captures can't be fixed; only re-captured.

**Risk:** Operator friction. Higher abandonment.

**Recommended treatment:** Add inline edit mode + PATCH route + audit append on edit. Documented in BLOCKERS.md (2026-04-21).

**Routing:** Schedulable, lower priority than P1-4.

### P1-6. `contacts` table missing `slug`, `photo_url`, `tagline`

**Location:** `~/crm/BLOCKERS.md` open entry 2026-04-21.

**Evidence:** `/agents/[slug]` route reads from a hardcoded `AGENTS` const in `src/app/agents/[slug]/page.tsx`. Adding a new agent requires editing source code.

**Risk:** Manual onboarding for every public agent page. Three agents currently (Julie, Fiona, Denise). Scales poorly.

**Recommended treatment:** Migration adding three columns + backfill + refactor page to query Supabase. RLS open for anon SELECT on those three columns only.

**Routing:** Schedulable plumbing slice.

### P1-7. Slice-6 shim files (`lib/claude/*`) still present

**Location:** `src/lib/claude/brief-client.ts`, `src/lib/claude/draft-client.ts`, `src/lib/inbox/scorer.ts`.

**Evidence:** Slice 6 introduced `src/lib/ai/*` and replaced inline Claude callers with shim files that re-export from the new namespace. The shims remain to avoid touching every caller in one slice. Per BUILD.md, deletion is scheduled for "Slice 7+."

**Risk:** Two import paths for the same capability. New code may import from the legacy `claude/` path inadvertently.

**Recommended treatment:** Sweep all callers to import directly from `@/lib/ai/*`, then delete the three shims. One-pass refactor; tests stay green.

**Routing:** Slice 7+ as planned. No rush.

### P1-8. `materials/` component directory not renamed to `tickets/` after Slice 3B

**Location:** `src/components/materials/`.

**Evidence:** Slice 3B renamed the DB table and route (`material_requests` -> `tickets`, `/materials` -> `/tickets`). Component directory was not renamed. Imports still resolve as `@/components/materials/*`.

**Risk:** Naming drift. Two vocabularies in code (`materials` for components, `tickets` for routes + DB).

**Recommended treatment:** `git mv` the directory + path-only PR. Trivial.

**Routing:** Schedulable hygiene slice.

---

## P2 -- refactor opportunity

### P2-1. `task-list.tsx` is 979 lines of mixed concerns

**Location:** `src/components/dashboard/task-list.tsx`.

**Evidence:** State management + render + mutations + Realtime subscriptions for six task buckets (overdue follow-ups, closings today/tomorrow, agents going cold, scheduled meetings, proactive touchpoints, pipeline items needing attention). Per `~/crm/docs/task-list-widget.md`, this is the canonical Tier-1 Linear Focus widget.

**Risk:** High change cost. Bug surface area is wide. Realtime invalidation logic is in the same file as render.

**Recommended treatment:** Decompose into:
- `task-list-shell.tsx` -- the bento card frame + 6-bucket scaffold
- `task-bucket.tsx` -- one bucket render component
- `use-task-bucket-query.ts` -- per-bucket query hook with staleTime override
- `use-task-list-realtime.ts` -- Realtime subscription that invalidates the right bucket query keys

Land as one focused refactor PR with snapshot test for each bucket render.

**Routing:** Schedulable. Not urgent.

### P2-2. `analytics/page.tsx` is 923 lines with hand-rolled charts

**Location:** `src/app/(app)/analytics/page.tsx`.

**Evidence:** Direct Recharts usage without shadcn Chart wrapper. Per `~/crm/docs/INDEX.md`, the page also hand-rolls data aggregation across multiple tables.

**Risk:** Charts diverge from rest of system. Maintenance cost grows as analytics surface expands.

**Recommended treatment:** Wrap each chart in shadcn Chart for consistency + tooltip standardization. Extract data hooks into `lib/analytics/queries.ts`. Split each chart into its own component file.

**Routing:** Schedulable.

### P2-3. `lib/captures/actions.ts` is 531 lines covering 5 promotion targets

**Location:** `src/lib/captures/actions.ts`.

**Evidence:** `promoteCapture()` handles five promotion targets (interaction, note, follow_up, ticket, touchpoint, event) plus shared helpers (`mapKeywordToInteractionType`, `buildTicketTitle`, etc.).

**Risk:** Single file owns six branches of business logic. Adding a new target requires changes throughout.

**Recommended treatment:** Split per target into `lib/captures/handlers/<target>.ts` with a thin `actions.ts` dispatcher. Mirrors the post-creation hooks pattern.

**Routing:** Schedulable.

### P2-4. `today-v2/queries.ts` carries a copy of `CADENCE` constants

**Location:** `src/app/(app)/today-v2/queries.ts:31`.

**Evidence:** Per BUILD.md 2026-04-26 (Phase 008), the canonical `CADENCE` lives at `src/lib/scoring/temperature.ts` (parked behind branch `dddc0b0` on `gsd/006-...` until post-Slice-4 merge). today-v2 has an inline copy as a deliberate decision.

**Risk:** Two sources of truth for cadence rules. Drift if temperature.ts changes and today-v2 doesn't.

**Recommended treatment:** Per BUILD.md, wait for the post-Slice-4 merge to land then collapse. Tracked in LATER.md.

**Routing:** Already on the schedule.

### P2-5. `events/invite-templates.ts` is 715 lines of consolidated renderers

**Location:** `src/lib/events/invite-templates.ts`.

**Evidence:** Slice 3B intentionally merged 8 sub-files into one. Four renderers (home tour, class day, content day, happy hour) + shared shell + signature + types.

**Risk:** Each renderer's body is independent but they share `firstName` + `buildPlainText` helpers. Changing one renderer requires rereading the whole file.

**Recommended treatment:** Stay consolidated for now (Slice 3B made the call). If a fifth renderer arrives, reconsider. Not debt today.

**Routing:** No action.

### P2-6. shadcn Chart wrapper not adopted

**Location:** `src/app/(app)/analytics/page.tsx`, `src/components/dashboard/campaign-timeline.tsx` (and any other chart sites).

**Evidence:** Per `~/crm/docs/INDEX.md` "What was not documented" section, the team uses Recharts directly without the shadcn Chart wrapper.

**Risk:** Tooltip styling, theming, and accessibility patterns diverge per chart site.

**Recommended treatment:** Adopt shadcn Chart in a coordinated pass. Low-risk; cosmetics + a11y win.

**Routing:** Schedulable.

### P2-7. Bento dashboard is a static `grid-cols-1 lg:grid-cols-3`, not the spec'd `grid-template-areas`

**Location:** `src/app/(app)/dashboard/page.tsx`.

**Evidence:** Per `dashboard-architecture.md` (in `~/.claude/rules/`) the locked decision is bento via CSS Grid `grid-template-areas`. Current dashboard uses Tailwind grid-cols.

**Risk:** Doesn't match the policy. Future widget reordering or size changes require Tailwind config rather than the canonical area-name approach.

**Recommended treatment:** Migrate to `grid-template-areas` with the four sizes (hero 2x2, medium 2x1, compact 1x1, tall 1x2) per the spec. Defer until next dashboard expansion.

**Routing:** Schedulable.

---

## P3 -- punch list

### P3-1. README.md says `npm install` and `npm run dev`

**Location:** `~/crm/README.md` lines 35-46.

**Evidence:** README still uses npm; CLAUDE.md mandates pnpm.

**Risk:** New contributors install with npm and create lock file conflicts.

**Recommended treatment:** Replace `npm` with `pnpm` in README. Ten-line edit.

**Routing:** Trivial.

### P3-2. README.md "Features (Phase 1)" describes a pre-Slice schema

**Location:** `~/crm/README.md`.

**Evidence:** README mentions follow_ups, deals, the `seed_data(user_id)` SQL function, and "5 Phoenix-area real estate agents." Slice 2C dropped follow_ups + deals; the demo seed function is the legacy path; the system has 105 contacts now.

**Risk:** Outdated README confuses readers. Not user-facing, but visible to anyone who lands on the repo.

**Recommended treatment:** Refresh README to reflect post-Slice-7A reality.

**Routing:** Add to a docs hygiene pass.

### P3-3. `lib/temperature.ts` and `lib/scoring/temperature.ts` co-exist

**Location:** `src/lib/temperature.ts` + `src/lib/scoring/temperature.ts`.

**Evidence:** Both files exist. The scoring/ one is the canonical one per BUILD.md Phase 008. The top-level one is legacy.

**Risk:** Two import paths, easy to import the wrong one.

**Recommended treatment:** Delete the unused one (verify zero imports first). One-line.

**Routing:** Trivial.

### P3-4. `interactions_legacy` table still live as a VIEW backfill

**Location:** `~/crm/SCHEMA.md` row "interactions_legacy".

**Evidence:** Slice 2C kept the legacy table for the `interactions` VIEW Part A. Slice 3 backfilled the rows into `activity_events` with `verb='interaction.backfilled'`. The legacy table can be DROPped now.

**Risk:** Schema clutter. View references both legacy table and activity_events.

**Recommended treatment:** Drop `interactions_legacy` after confirming the VIEW reads only from `activity_events` (Slice 3 already rewrote the VIEW to drop Part A; legacy table drop deferred). Per BLOCKERS.md "Resolved" 2026-04-24, this should already be done; spot-verify via SCHEMA.md.

**Routing:** Verification pass.

### P3-5. `LATER.md` exists; track its growing list

**Location:** `~/crm/LATER.md`.

**Evidence:** Per CLAUDE.md, mid-session "do this later" items go to LATER.md. The file is a debt accumulator by design.

**Risk:** LATER.md items can grow unbounded if no quarterly sweep.

**Recommended treatment:** Schedule a quarterly LATER.md triage. Convert items to BACKLOG.md or BLOCKERS.md or delete.

**Routing:** Calendar item.

### P3-6. `dashboard-architecture.md` rule says "deals + opportunities are both load-bearing" -- still true post-Slice-2C?

**Location:** `~/.claude/rules/dashboard-architecture.md` -- "On `deals` vs `opportunities`" section.

**Evidence:** The rule says deals = closing-date-driven, opportunities = pipeline-value-driven. **Slice 2C dropped `deals`** and merged its 13 columns into `opportunities`. The rule is now stale.

**Risk:** Future agent following the rule would assume both tables exist.

**Recommended treatment:** Update `~/.claude/rules/dashboard-architecture.md` to reflect Slice 2C reality. This is a Claude rules file (outside `~/crm/`) and outside the scope of this architecture pass; document the discovery and surface to Alex.

**Routing:** Alex updates `~/.claude/rules/dashboard-architecture.md` separately.

### P3-7. `agent_health` view -- is it actually live?

**Location:** `~/crm/SCHEMA.md` row "agent_health".

**Evidence:** Per BUILD.md 2026-04-26 (out-of-pattern QA fix on commit `b58e998`), the dashboard "stubbed agent_health queries that were returning errors." The view exists per SCHEMA.md but had errors.

**Risk:** Health-score widgets may be silently empty.

**Recommended treatment:** Alex verifies the materialized view refreshes correctly under cron `recompute-health-scores`. Spot-test query: `SELECT COUNT(*) FROM agent_health WHERE deleted_at IS NULL`.

**Routing:** Alex's morning check.

### P3-8. ROADMAP.md has 4 unresolved [PLACEHOLDER: needs confirm] entries

**Location:** `~/crm/ROADMAP.md` "Ship Target Dates" table.

**Evidence:** Phase 2.2 (First Weekly Edge live), 2.3 (Voice memo capture), 2.4 (Calendar two-way sync), 3.3 (Agent portal v1) all carry `[PLACEHOLDER: needs confirm]`.

**Risk:** Roadmap drift. Stale targets confuse planning.

**Recommended treatment:** Alex fills in or removes. Trivial.

**Routing:** Alex's hygiene.

### P3-9. `seed.sql` describes 10 demo contacts; live DB has 105

**Location:** `supabase/seed.sql`.

**Evidence:** README mentions a `seed_data(user_id)` SQL function inserting 10 contacts. Live DB has 105 (per ROADMAP.md "Phase 1.2 Spine Data Model"). Seed file may be stale.

**Risk:** Local demo flow mismatches production.

**Recommended treatment:** Decide whether the seed file should match prod (regenerate) or stay as a demo set. Document.

**Routing:** Documentation pass.

### P3-10. 19 import sites of `useQuery` use mixed staleTime patterns

**Location:** various.

**Evidence:** Per `~/crm/docs/tanstack-query-provider.md`, default staleTime is set globally with per-data-type overrides. Spot-checking, some queries use ad-hoc staleTime values.

**Risk:** Cache invalidation surprises. Some data is fresher than expected, some staler.

**Recommended treatment:** Audit + standardize per the documented stale-time table (60s KPIs, 30s tasks, 5min profiles, Infinity prefs).

**Routing:** Schedulable hygiene.

---

## CLAUDE.md vs. reality discoveries

These are mismatches between `~/crm/CLAUDE.md` (or the global rules at `~/.claude/rules/`) and current code. Documented for Alex's reading.

| Doc says | Reality |
|---|---|
| CLAUDE.md: "Do not add new writes to spine tables (spine_inbox, commitments, signals, focus_queue, cycle_state) -- they are deprecated as of Slice 1 and will be dropped in Slice 2." | Spine tables ARE dropped (Slice 2A, 2026-04-23). CLAUDE.md still describes the deprecation as future tense. |
| CLAUDE.md "Do not run /gsd-new-project until Gmail MVP 1.3.1 ships." | Gmail MVP 1.3.1 shipped 2026-04-19. Gate is no longer load-bearing; CLAUDE.md retains the old caution. |
| `~/.claude/rules/dashboard-architecture.md` "deals + opportunities are both first-class" | Slice 2C dropped deals. Rule is stale. (Already covered in P3-6.) |
| README.md "Features (Phase 1)" lists follow_ups + tags as runtime concepts | Tags exist; follow_ups was dropped in Slice 2C and migrated into `tasks` with `type='follow_up'`. README is stale. |

These don't break anything; they just confuse readers.

---

## Test-coverage gap (P1 systemic, listed once)

5 test files / ~32k LOC. Critical paths covered: tenantFromRequest (auth), intake processing, draftActions state machine, rate-limit window math, weeklyWhere DST math. Uncovered: every API route handler (post-mortem-only via slice smoke scripts), every UI component (no Testing Library tests), every page-level integration. Realtime subscriptions have only manual smoke verification.

Recommended treatment: a focused testing slice (Slice 8 candidate) that adds Testing Library tests for the top 5 most-imported components and Playwright end-to-end happy-path tests for capture create + email approve-and-send + intake submit. Stretch: API route smoke via `supertest`. The smoke scripts in `~/crm/scripts/` cover much of this informally; promote them to CI gates.

---

## Cleanup-ready surfaces (low-risk wins)

These have zero in-flight work touching them and are safe to fix in any plumbing slice:

1. README.md modernization (P3-1, P3-2, P3-9) -- 30-minute pass.
2. `materials/` component directory rename (P1-8) -- one `git mv` + path updates.
3. Delete legacy `lib/temperature.ts` (P3-3) -- verify-and-delete.
4. Add captures cleanup-audio cron (P1-1) -- 1-line `vercel.json` edit.
5. Drop `interactions_legacy` (P3-4) -- single migration once SCHEMA.md verifies.

---

## Cross-references

- Module map and ownership: `system-map.md`
- Auth perimeter (the off-limits zone): `auth-flow.md`
- Per-flow tracing: `data-flow.md`
- Concrete dependency findings: `dependency-analysis.md`
- Top-level handoff summary: `EXECUTIVE_SUMMARY.md`

---

## Remaining placeholders

This document carries no unresolved placeholders of its own. Two references to `[PLACEHOLDER: needs confirm]` appear in P3-8 strictly as quoted citations from `~/crm/ROADMAP.md` lines 167-170 (Phase 2.2 / 2.3 / 2.4 / 3.3 ship-target rows), which Alex resolves separately when he confirms ship dates. They are not gaps in this architecture pass.
