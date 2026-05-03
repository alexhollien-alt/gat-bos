# Priority Action Plan -- GAT-BOS Infrastructure

**Generated:** 2026-05-01
**Branch:** gsd/016-slice-7a5-migration-reconciliation

This is the consolidated, ranked recommendation list across all 7 audit docs. Use this as the post-7A.5 backlog seed.

---

## How to read this

- **Severity** = Critical / High / Medium / Low.
- **Blast radius** = how many files / systems a fix touches.
- **Depends-on-7A.5** = whether the fix has to wait for migration history to be reconciled.
- **Patch drafted** = whether `proposed-patches/*.diff` contains a ready-to-review draft.
- **Approval gate** = always Alex; this column names whether it needs *just* Alex (single-person review) or also a separate audit / pairing session.

---

## CRITICAL

*(none)*

No findings rose to Critical severity in this audit. The closest candidates were the high-CVE Next.js advisories (S6) and the auth-model architecture (S5); both remain HIGH because mitigation is non-trivial and current behavior is intentional.

---

## HIGH

### A1 -- Land `.env.example`
**Source:** S1, P1, H1
**Why:** 5 env vars referenced in code but not in `.env.local` (most exposed: `OPENAI_API_KEY` in `/api/transcribe`). Future operators can't tell what's required.
**Fix:** Drop a `.env.example` listing every key the codebase reads.
**Blast radius:** 1 new repo file. Zero code touched.
**Depends on 7A.5:** No.
**Patch drafted:** `proposed-patches/01-env-example.diff`. NOT landed in-tree (per the audit-first plan default; ALL patches stay in `proposed-patches/` until 7A.5 lands).
**Approval gate:** Alex.

### A2 -- Add `error.tsx` + `global-error.tsx`
**Source:** R4, H6
**Why:** No error boundary; uncaught server-component errors render Next's default UI; uncaught root-layout errors take down the app.
**Fix:** Two minimal files at `src/app/error.tsx` + `src/app/global-error.tsx` calling `logError()` and rendering a recover-friendly UI.
**Blast radius:** 2 new files. Zero existing edits.
**Depends on 7A.5:** No.
**Patch drafted:** `proposed-patches/05-error-boundaries.diff`. NOT landed in-tree -- still requires Alex review of the UI / copy.
**Approval gate:** Alex.

### A3 -- Add CI test asserting every API route enforces auth
**Source:** S5, H2
**Why:** Middleware bypasses `/api/*`. Each route MUST self-enforce. Pattern relies on author discipline -- no test catches a forgotten `verifyCronSecret` call.
**Fix:** Test file under `src/app/api/__tests__/route-auth.test.ts` that walks every `route.ts` under `src/app/api/**` (excluding the public list `/api/intake`, `/api/webhooks/resend`, `/api/auth/gmail/*`) and asserts the file source includes one of `requireApiToken`, `verifyCronSecret`, `verifySession`, `verifyBearerOrSession`.
**Blast radius:** 1 new test file.
**Depends on 7A.5:** No.
**Patch drafted:** `proposed-patches/06-route-auth-test.md` (sketch with reasoning; not a runnable diff because the AST/file-walk pattern needs review).
**Approval gate:** Alex.

### A4 -- Plan + execute Next.js 14 -> 16 upgrade
**Source:** S6, S7, H3
**Why:** 3 high CVEs in next 14.x; 14.2.35 is two majors behind 16.2.4. React 18 -> 19 also required.
**Fix:** Use `vercel:next-upgrade` skill to drive the codemod-assisted upgrade. Likely a 1-2 day session.
**Blast radius:** Touches every page, route handler, middleware, Server Action.
**Depends on 7A.5:** YES.
**Patch drafted:** No (not an overnight task).
**Approval gate:** Alex (dedicated session).

### A5 -- Add idempotency keys for Resend webhook + cron jobs
**Source:** P5, R1, H5
**Why:** Vercel cron + Resend webhook are at-least-once. Duplicate events re-bump scores, re-send emails, re-write events.
**Fix:**
  - Schema: `message_events` add unique index on `(provider_message_id, event_type)`.
  - Schema: `morning_briefs` add unique on `(user_id, brief_date)` if not present.
  - Code: Resend webhook insert uses `on conflict do nothing`.
**Blast radius:** Schema migrations + 1 route edit.
**Depends on 7A.5:** YES (schema work).
**Patch drafted:** No.
**Approval gate:** Alex + paired schema review.

### A6 -- Promote campaign-runner tick body to a single SQL RPC
**Source:** P4, R7, H4
**Why:** Multi-write paths today are not transactional. Campaign-runner can double-send if "advance" fails after "send" succeeds.
**Fix:** New `advance_campaign_step()` RPC wraps "send -> insert completion -> advance enrollment" in a transaction. Route handler calls the RPC after successful send.
**Blast radius:** New migration + RPC + 1 route refactor.
**Depends on 7A.5:** YES.
**Patch drafted:** No.
**Approval gate:** Alex + paired schema review.

### A7 -- Install Sentry @sentry/nextjs (or equivalent APM)
**Source:** O1, O4, H7
**Why:** Today, errors that don't get an explicit `logError()` call vanish. No metrics, no alerts, no dashboards.
**Fix:** Install `@sentry/nextjs`, configure server + client + edge. Free tier.
**Blast radius:** 1 npm package, 1 config file, 1 layout.tsx import.
**Depends on 7A.5:** No (purely additive).
**Patch drafted:** No (Sentry CLI does most of this; manual judgment on filters).
**Approval gate:** Alex.

### A8 -- Per-route zod adoption on write endpoints
**Source:** P3, H8
**Why:** Only `/api/intake` has full zod validation. Other write routes (`/api/contacts`, `/api/projects`, `/api/email/*`, `/api/calendar/create`, `/api/transcribe`, `/api/activity/interaction`) are unvalidated or unverified.
**Fix:** Per-route `request.json()` -> `schema.safeParse()` -> 400 on failure. Schemas live in `src/lib/validations.ts`.
**Blast radius:** 1 route per landing; ~7 routes total.
**Depends on 7A.5:** No, but should be sequenced with route-by-route work.
**Patch drafted:** `proposed-patches/03-route-validation-patterns.md` (review-only doc).
**Approval gate:** Alex (per-route).

---

## MEDIUM

### A9 -- Centralized `src/lib/env.ts` zod-validated env loader
**Source:** S2, P1
**Why:** 52 `process.env.*!` sites; no schema; cold-start failures nondeterministic.
**Fix:** New `src/lib/env.ts` exports `env` object validated at module-load time. New routes import `env`; existing 52 sites migrate one-at-a-time on next-touch.
**Blast radius:** 1 new file. No required existing edits.
**Depends on 7A.5:** No.
**Patch drafted:** `proposed-patches/02-env-loader.diff`.
**Approval gate:** Alex.

### A10 -- Land `.nvmrc` + `package.json` `engines` field
**Source:** -- (operational)
**Why:** No Node version pin in repo or `package.json`. Vercel pin is implicit; local dev divergence possible.
**Fix:** `.nvmrc` with the Node major matching Vercel build. `engines.node` in `package.json`.
**Blast radius:** 1 new file + 1 line in package.json.
**Depends on 7A.5:** No.
**Patch drafted:** `proposed-patches/08-nvmrc-engines.diff`. NOT landed in-tree (per the audit-first plan default).
**Approval gate:** Alex.

### A11 -- Document the 5 ROLLBACK flags in a runbook
**Source:** R5
**Why:** 5 rollback flags exist (gmail-sync, draft-gen, send, cal-write, cal-sync) but are undocumented. A future operator under outage pressure has to grep src/ to find them.
**Fix:** Land `~/crm/docs/infrastructure/ROLLBACK_FLAGS.md` (the operational runbook section in reliability-report.md is the seed).
**Blast radius:** 1 new doc file.
**Depends on 7A.5:** No.
**Patch drafted:** Effectively folded into reliability-report.md "Operational runbook" section.
**Approval gate:** Alex.

### A12 -- Standardize "is production?" predicate
**Source:** R6
**Why:** Some routes use `NODE_ENV`, some `VERCEL_ENV`, some both. Vercel preview = `NODE_ENV=production` but `VERCEL_ENV=preview`; routes gating only on `NODE_ENV` run prod paths in preview.
**Fix:** Single `isProd()` helper in `src/lib/env.ts` (when A9 lands). Migrate 5 sites.
**Blast radius:** 5 file edits.
**Depends on 7A.5:** No, but bundles with A9.
**Patch drafted:** Folds into A9 patch.
**Approval gate:** Alex.

### A13 -- Wrap server-action error logging
**Source:** O2
**Why:** Server actions in `src/app/(app)/**/actions.ts` `console.error` only; no `logError()` -> no durable trail.
**Fix:** `withErrorLog(handler)` HOF that wraps the action body and routes failures to `error_logs`. Sketched in `proposed-patches/07-error-log-helper.md`.
**Blast radius:** 1 new helper + per-action adoption.
**Depends on 7A.5:** No.
**Patch drafted:** `proposed-patches/07-error-log-helper.md` (sketch).
**Approval gate:** Alex.

### A14 -- Land minimal CI workflow (typecheck + lint + vitest on PR)
**Source:** -- (operational)
**Why:** No `.github/workflows/`. PRs land with no CI gate today.
**Fix:** `.github/workflows/ci.yml` runs `pnpm typecheck`, `pnpm lint`, `pnpm test --coverage` on every PR.
**Blast radius:** 1 new file.
**Depends on 7A.5:** No.
**Patch drafted:** `proposed-patches/09-ci-workflow.diff`.
**Approval gate:** Alex (gh PR settings + secret config).

### A15 -- Per-route auth audit deep dive
**Source:** S5, P3
**Why:** This audit verified auth on 4 of ~31 routes. The other ~27 are UNKNOWN.
**Fix:** Read every route handler; build a matrix in `docs/infrastructure/route-auth-matrix.md`.
**Blast radius:** Read-only deep dive; new doc.
**Depends on 7A.5:** No.
**Patch drafted:** No (overnight context budget; deferred).
**Approval gate:** Alex.

---

## LOW

### A16 -- Land `noUncheckedIndexedAccess: true` in tsconfig
**Source:** S8
**Why:** Hardens against `array[i]` returning T instead of T | undefined.
**Fix:** tsconfig.json edit + triage of new errors.
**Blast radius:** 1 config edit; meaningful number of new type errors expected.
**Depends on 7A.5:** No.
**Patch drafted:** No (NOT autonomously safe; needs Alex on the triage).
**Approval gate:** Alex.

### A17 -- Bump safe minor deps (Anthropic SDK, Supabase, Resend, zod, react-query)
**Source:** S7
**Why:** Bumps without breaking changes; reduces audit surface.
**Fix:** `pnpm up @anthropic-ai/sdk @supabase/supabase-js resend zod @tanstack/react-query` (NOT inside an autonomous run).
**Blast radius:** lockfile + small package.json change.
**Depends on 7A.5:** No, but coordinate with Vercel deploy window.
**Patch drafted:** No.
**Approval gate:** Alex.

### A18 -- Read `src/lib/retry.ts` to confirm contract
**Source:** P6
**Why:** File exists, 0% coverage, not inspected this pass.
**Fix:** Read the file; document or delete as appropriate.
**Blast radius:** Read-only; possibly 1 file delete.
**Depends on 7A.5:** No.
**Patch drafted:** No.
**Approval gate:** Alex.

### A19 -- Add Vercel Analytics
**Source:** O4
**Why:** Drop-in p50/p95 visibility.
**Fix:** `pnpm add @vercel/analytics`, 1 import in `src/app/layout.tsx`.
**Blast radius:** 1 package + 1 layout import.
**Depends on 7A.5:** No.
**Patch drafted:** No.
**Approval gate:** Alex.

### A20 -- Cron-health widget on `/today`
**Source:** O4
**Why:** Surfaces stale-cron alarms ("campaign-runner last ran 47 min ago") to Alex.
**Fix:** SQL view `cron_health` (MAX(occurred_at) per cron verb) + a card on `/today-v2`.
**Blast radius:** Schema (view only) + 1 component.
**Depends on 7A.5:** YES (schema).
**Patch drafted:** No.
**Approval gate:** Alex.

### A21 -- AI-spend widget on `/today`
**Source:** O5
**Why:** Daily spend is invisible until the soft-cap fires. A budget-bar widget makes the burn rate observable.
**Fix:** Card on `/today-v2` calling `current_day_ai_spend_usd()` + reading `AI_DAILY_BUDGET_USD`.
**Blast radius:** 1 component.
**Depends on 7A.5:** No.
**Patch drafted:** No.
**Approval gate:** Alex.

---

## Summary by depends-on-7A.5

| Depends on 7A.5? | Items |
|------------------|-------|
| **No** (can land now or any time) | A1, A2, A3, A7, A8, A9, A10, A11, A12, A13, A14, A15, A16, A17, A18, A19, A21 |
| **Yes** (wait for migration reconciliation) | A4, A5, A6, A20 |

---

## Suggested ordering post-7A.5

1. **Week 1 unblockers (no schema):** A1 (already drafted), A10 (already drafted), A2 (drafted), A14 (drafted), A11 (folded). Land these first because they're additive zero-risk.
2. **Week 1 hardening:** A9 + A12 (env loader + isProd helper).
3. **Week 2 observability:** A19 (Vercel Analytics) -> A7 (Sentry) -> A21 (AI-spend widget).
4. **Week 2 testing:** A3 (route-auth CI test); A18 (retry.ts confirm).
5. **Week 3 schema (post-7A.5 lands):** A5 (idempotency keys), A6 (campaign-runner RPC), A20 (cron-health view).
6. **Quarter scope:** A4 (Next.js 14 -> 16); A15 (route-auth deep dive); A8 (per-route zod); A17 (minor dep bumps).

---

## Remaining placeholders

- None.
