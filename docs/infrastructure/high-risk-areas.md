# High-Risk Areas -- GAT-BOS

**Generated:** 2026-05-01
**Branch:** gsd/016-slice-7a5-migration-reconciliation
**Severity threshold:** High and above (Critical/High only)

---

## H1 -- Undocumented env vars referenced in code, not set in `.env.local`

**Severity:** HIGH
**Source:** security-audit.md S1
**Current state:** 5 env vars referenced from runtime code but missing from `.env.local`. The most exposed is `OPENAI_API_KEY`, used by `/api/transcribe/route.ts` for voice-capture transcription. First call in prod returns 500. Other four are `ESCALATION_NOTIFY`, `CAPTURES_AI_PARSE`, and the five `ROLLBACK_*` flags -- all default-to-falsy and so silently no-op when unset.
**Recommended fix:** Land `.env.example` listing every env var the codebase references. Drafted in `proposed-patches/01-env-example.diff`.
**Blast radius:** Single repo file (`.env.example`). No code touched. No env-loader plumbing changes. Zero collision with 7A.5.
**Who must approve:** Alex.
**Depends on 7A.5:** No.

---

## H2 -- Auth model: middleware bypass + per-route enforcement (architectural)

**Severity:** HIGH
**Source:** security-audit.md S5
**Current state:** `src/middleware.ts:36-44` bypasses all of `/api/*`, `/intake/*`, `/agents/*`. Each `/api/*` route MUST self-enforce auth via `requireApiToken`, `verifyCronSecret`, `verifySession`, `verifyBearerOrSession`, or Svix verification. The pattern relies on author discipline; nothing fails-closed if a future route omits the call.
**Recommended fix:** Add a CI test that imports every route handler in `src/app/api/**/route.ts` (excluding the explicit public list: `/api/intake`, `/api/webhooks/resend`) and asserts the file references at least one of the recognized auth helpers. Sketched in `proposed-patches/06-route-auth-test.md`.
**Blast radius:** New test file under `src/app/api/__tests__/` or `tests/`. Zero touch to any route or middleware. Zero collision with 7A.5.
**Who must approve:** Alex.
**Depends on 7A.5:** No (test-only).

---

## H3 -- Three high-severity npm advisories; Next.js 2 majors behind

**Severity:** HIGH
**Source:** security-audit.md S6
**Current state:** `pnpm audit --json` reports 3 high (CVE-2025-64756 glob CLI, CVE-2024-50383 next, CVE-2025-24761 next) + 14 moderate. Next.js 14.2.35 is two majors behind 16.2.4; React 18.3.1 is one major behind 19.2.5.
**Recommended fix:** Schedule a Next.js upgrade window post-7A.5. Bumping next 14 -> 16 spans App Router caching changes (PPR), middleware runtime changes, and Server Action signature shifts. The `vercel:next-upgrade` skill runs the official codemods; this is not a one-PR job.
**Blast radius:** Touches every page, route handler, middleware, and Server Action in the codebase. NOT safe for an overnight autonomous run. Listed here as a critical-priority backlog item.
**Who must approve:** Alex; ideally as a 1-2 day dedicated session post-7A.5.
**Depends on 7A.5:** Yes -- migration history must be reconciled first.

---

## H4 -- No multi-write transactions on critical paths

**Severity:** HIGH
**Source:** plumbing-audit.md P4
**Current state:** Postgres RPCs are the only transactional surface. Direct service-role insert/update chains via `adminClient` from a route handler do NOT execute in a single transaction. Specific exposure: campaign-runner's "send -> advance current_step -> insert completion" triplet. If "advance" fails after "send" succeeds, the next tick double-sends.
**Recommended fix:** Promote campaign-runner's tick body to a single `advance_campaign_step()` SQL RPC that wraps the multi-write in a transaction. Schema work; HANDS-OFF until 7A.5 lands.
**Blast radius:** New migration + RPC + route refactor to call the RPC. Touches one cron handler. Cannot land during 7A.5.
**Who must approve:** Alex.
**Depends on 7A.5:** Yes.

---

## H5 -- Idempotency gaps on cron + webhook -- duplicate side effects under at-least-once delivery

**Severity:** HIGH
**Source:** plumbing-audit.md P5, reliability-report.md R1
**Current state:** Vercel cron is at-least-once; Resend webhook is at-least-once. The campaign-runner is partially protected by its time-window query. The Resend webhook has NO idempotency key; a duplicated event re-bumps `health_score` and re-writes `activity_events`. `morning-brief`, `touchpoint-reminder`, `inbox/scan`, `gmail/sync` not deeply audited but likely lack dedup keys.
**Recommended fix:** Add `provider_message_id + event_type` unique index on `message_events`. Add per-cron idempotency key column where the row identity is not already unique (e.g. `morning_briefs (user_id, brief_date)` unique). Schema work; HANDS-OFF until 7A.5 lands.
**Blast radius:** Schema migrations. Cannot land during 7A.5.
**Who must approve:** Alex.
**Depends on 7A.5:** Yes.

---

## H6 -- No error boundary in the App Router

**Severity:** HIGH
**Source:** reliability-report.md R4
**Current state:** No `src/app/error.tsx`, no `src/app/global-error.tsx`. An uncaught error in a server component renders Next's default error UI (white screen + status code); an error in the root layout takes down the whole app.
**Recommended fix:** Add minimal `error.tsx` + `global-error.tsx` that show a recover-friendly UI and call `logError()`. Drafted in `proposed-patches/05-error-boundaries.diff`. ADDITIVE; touches no existing file.
**Blast radius:** Two new files. Zero collision with 7A.5.
**Who must approve:** Alex.
**Depends on 7A.5:** No.

---

## H7 -- No external APM, no metrics, no alerts

**Severity:** HIGH
**Source:** observability-gaps.md O1, O4
**Current state:** No Sentry, no OpenTelemetry, no Datadog, no Vercel Analytics. Only durable signal is `error_logs` table, populated explicitly by route authors via `logError()`. Cron-job staleness, latency regressions, error-rate spikes, and Resend delivery health are invisible.
**Recommended fix:** Phase 1: install `@vercel/analytics`. Phase 2: install Sentry. Phase 3: add `cron_health` widget to `/today`. None autonomously applied.
**Blast radius:** Phase 1 is 1 line of code in `src/app/layout.tsx` plus a package install. Phase 2 is 30 minutes. Phase 3 is a SQL view + a card on `/today-v2`.
**Who must approve:** Alex.
**Depends on 7A.5:** No (additive); but Phase 2 should wait until the auth model audit (H2) clarifies which routes are observable.

---

## H8 -- Sparse zod validation across API write surface

**Severity:** HIGH
**Source:** plumbing-audit.md P3
**Current state:** Only 5 files import zod. The intake route (`/api/intake`) is fully validated. Other write routes (`/api/contacts`, `/api/projects`, `/api/email/generate-draft`, `/api/email/approve-and-send`, `/api/calendar/create`, `/api/transcribe`, `/api/activity/interaction`) were not deeply inspected; their body-validation status is UNKNOWN.
**Recommended fix:** Per-route zod adoption, post-7A.5. Each route needs a `safeParse()` of `request.json()` against a schema in `src/lib/validations.ts` or a per-route schema file.
**Blast radius:** Each route. NOT autonomously applied; per-route changes belong with their next feature edit.
**Who must approve:** Alex.
**Depends on 7A.5:** No, but should be sequenced after.

---

## Severity rollup

All findings above are HIGH. No CRITICAL findings observed in this audit.

| Source area | High count |
|-------------|------------|
| Security | 3 (H1, H2, H3) |
| Plumbing | 3 (H4, H5, H8) |
| Reliability | 1 (H6) |
| Observability | 1 (H7) |
| **Total** | **8** |

---

## Remaining placeholders

- None.
