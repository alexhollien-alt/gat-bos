# Observability Gaps -- GAT-BOS

**Generated:** 2026-05-01
**Branch:** gsd/016-slice-7a5-migration-reconciliation

---

## What was audited

- Logging surface in `src/` (21 `console.*` calls + `logError()` shim).
- `src/lib/error-log.ts` coverage map.
- `audit_log` / `activity_events` coverage as the de-facto audit trail.
- External APM presence (Sentry, OpenTelemetry, Datadog, Vercel Analytics).
- Realtime observability (Supabase channel subscriptions).
- AI-spend visibility (`ai_usage_log`, `ai_cache`, `_budget.ts`).

---

## O1 -- No external APM / error tracker -- HIGH

Searched `package.json` and `src/` imports for: `@sentry/*`, `@opentelemetry/*`, `datadog`, `@vercel/analytics`, `pino`, `winston`. **Zero matches.**

Current observability stack:

| Layer | Tool | Coverage |
|-------|------|----------|
| Application errors | `error_logs` table via `logError()` | Cron + webhook + intake routes |
| User-observable actions | `activity_events` table via `writeEvent()` | Every server-side write path (Slice 1+) |
| Infrastructure | Vercel build logs + function logs | All routes; ephemeral, no long-term retention without external aggregation |
| AI spend | `ai_usage_log` + `ai_cache` tables | Per-feature, queried by `_budget.ts` |
| Frontend errors | `console.error` in 5 client components | Browser console only |

**Risk:** A 500 in a non-cron route (e.g. an RSC route or a server action) that does NOT call `logError()` is invisible unless a user reports it. The `error_logs` table only captures what the route author chose to log.

**Fix (proposal-only, do not auto-install):** Land Sentry @sentry/nextjs as the minimum. Captures unhandled errors in server components, route handlers, server actions, and middleware automatically. Costs roughly 0 for the free tier at our request volume. NOT auto-applied; documented in `proposed-patches/05-error-boundaries.diff` boundary file's TODO comment.

---

## O2 -- `error-log.ts` coverage map -- INCOMPLETE -- MEDIUM

`logError()` is called from:

```
src/app/api/intake/route.ts                     -- caught at outer try/catch
src/app/api/cron/campaign-runner/route.ts      -- 6 sites (due query, step lookup, complete, advance, send, tick wrapper)
src/app/api/webhooks/resend/route.ts            -- 2 sites
src/lib/ai/_budget.ts                           -- 1 site
src/lib/ai/capture-parse.ts                     -- referenced
src/lib/ai/inbox-score.ts                       -- referenced
src/lib/ai/draft-revise.ts                      -- referenced
src/lib/ai/morning-brief.ts                     -- referenced
```

**NOT covered (representative):**

- Server actions in `src/app/(app)/**/actions.ts` -- they `console.error` and return error tuples; no DB log.
- RSC route handlers in `src/app/(app)/**/page.tsx` -- they `console.error` and either render error state or throw. No DB log.
- `src/lib/intake/process.ts` -- console.error at L246, L283, L302; no logError.
- `src/lib/activity/queries.ts` -- console.error at L22, L37; no logError.
- Internal cron routes (morning-brief, touchpoint-reminder, recompute-health-scores, inbox/scan, gmail/sync, calendar/sync-in) -- coverage UNKNOWN; not audited deep this pass.

**Risk:** When something breaks in a server action or RSC, the failure surface is just Vercel function logs (ephemeral) and an end-user error. No durable record.

**Fix:** Wrap server actions in a `withErrorLog()` helper. Drafted as a sketch in `proposed-patches/07-error-log-helper.md`.

---

## O3 -- `activity_events` is excellent but NOT an error log -- INFO

Strong points:

- 33 references across 8 files; canonical write target for user-observable actions per Slice 1+.
- `writeEvent()` requires `userId` (hard-break post-7A); enforces tenant scoping.
- Verbs are a fixed union (`interaction.*`, `ai.*`, `capture.*`, `project.*`, `campaign.*`, ...).
- Used for audit trail, contact timeline, recent-activity feed.

This is the right primitive for a CRM audit log. Do not conflate with error logging -- `activity_events` is product-state, `error_logs` is failure-state. Keep them separate.

---

## O4 -- No metrics / dashboards / alerts -- HIGH

Zero infrastructure for:

- Latency (p50, p95, p99 per route).
- Error rate (5xx / total).
- Cron job success rate, last-run timestamp, lag.
- Resend delivery rate, bounce rate.
- AI spend per day vs budget cap.
- DB query times, slow-query log.

Vercel Analytics is not installed. Supabase Studio has built-in Postgres logs but is not wired to alerts.

**Risk:** A broken cron (campaign-runner stops firing because the bearer secret rotated, say) is invisible until Alex notices "no campaign emails went out today." No alert path.

**Fix:** Phase 1: add `@vercel/analytics` (free, drop-in) for request-side metrics. Phase 2: build a `cron_health` view that selects MAX(occurred_at) per cron route and surface in `/today` so Alex sees a "campaign-runner last ran 47 minutes ago" widget. NOT autonomously applied; both proposals; both gated on 7A.5 landing.

---

## O5 -- AI spend telemetry: present and good -- INFO

`src/lib/ai/_budget.ts` + `ai_usage_log` + `ai_cache` tables (Slice 6) provide:

- Daily USD spend per (feature, day) via `current_day_ai_spend_usd()` RPC.
- Soft-cap warning (80%) and hard-cap blocking (100%) events written to `activity_events`.
- Per-call cost record in `ai_usage_log`.
- Cache hits in `ai_cache`.

No daily summary widget on `/today`, but the data is there. Easy win post-7A.5.

---

## O6 -- Realtime observability surface -- INFO

`audit/2026-04-slice7a-migration-reconciliation/AUDIT-STATUS.md` notes Supabase Realtime subscriptions on `email_drafts`, `project_touchpoints`, `activity_events` in `today-v2/queries.ts` and the dashboard task list. These are product features, not observability. Mentioned for completeness.

**Risk:** None. Realtime is well-scoped to the dashboard and channel names are isolated per subscription.

---

## O7 -- Frontend error capture: missing -- MEDIUM

5 `console.error` calls in client code:

```
src/app/(app)/projects/[id]/page.tsx:56
src/app/(app)/contacts/[id]/page.tsx:98
src/components/ui/voice-input.tsx:103, 141
```

These land in the user's browser console only. No telemetry pipe.

**Risk:** Voice-capture mic permission errors (line 103) and transcribe errors (line 141) are common in field use; without telemetry, Alex never sees them.

**Fix:** Folds into O1 (Sentry adoption) or O2 (server error-log helper if voice-input gets a "/api/log-frontend-error" sink).

---

## Recommended observability stack (proposal only)

In order of value-per-effort:

1. **`@vercel/analytics`** -- 1 line of code; gives p50/p95 + traffic views in Vercel dashboard. Free.
2. **Sentry @sentry/nextjs** -- 30 minutes of setup; captures every server + client error. Free tier covers our volume.
3. **Cron health widget** -- query `MAX(occurred_at)` per cron `verb` from `activity_events` and surface stale-cron alerts on `/today`. Internal; uses existing tables.
4. **AI spend widget** -- query `current_day_ai_spend_usd()` and `AI_DAILY_BUDGET_USD`, render bar on `/today`. Internal; uses existing tables.
5. **Per-route latency slow-query log** -- Supabase `pg_stat_statements`; reading-only initially. Already enabled by default in newer Supabase projects.

None of the above autonomously land in this overnight run. All four are proposals for post-7A.5.

---

## Severity rollup

| Severity | Findings |
|----------|----------|
| Critical | none |
| High | O1 (no APM), O4 (no metrics/alerts) |
| Medium | O2 (error-log coverage gaps), O7 (no frontend error capture) |
| Low | (none flagged) |
| Info | O3 (activity_events is excellent), O5 (AI spend visible), O6 (realtime in product not obs) |

---

## Out of scope

- Sentry installation.
- Vercel Analytics installation.
- Cron-health view.
- AI-spend widget.
- Frontend telemetry sink.

---

## Remaining placeholders

- None.
