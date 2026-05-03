# Executive Summary -- GAT-BOS CRM Architecture Pass

**Generated:** 2026-05-01 from a read-only architecture pass against `~/crm/`.
**Scope:** Documentation only. No source files, migrations, or auth/RLS surfaces were modified. Slice 7A.5 (Migration History Reconciliation) was respected as in-flight.

This is the entry point. Read it first, then drill into the linked docs as needed.

---

## TL;DR

GAT-BOS is a single-operator multi-tenant CRM that ingests Alex Hollien's agent communications (Gmail, Calendar, intake form, captures) and triages follow-up. It runs on Next.js 14 + Supabase + Vercel with Anthropic Claude, Resend, and Google APIs as the only external integrations.

After 7 major slices of restructuring (1, 2A/B/C, 3A/B, 4, 5A/B, 6, 7A) shipped in April 2026, the codebase is **unusually clean for its scope**:

- Zero circular dependencies among high-traffic lib modules.
- 1 occurrence of `: any` across ~32k LOC src/ (excellent type discipline).
- Single tenant resolver (`tenantFromRequest`) with explicit failure modes.
- Single Anthropic wrapper (`callClaude`) composing budget guard + prompt cache + retry + usage log.
- Single canonical event ledger writer (`writeEvent`).
- 91 timestamped migrations, all conforming to the naming convention.

The debt is concentrated in three places:

1. A handful of large UI files (`task-list.tsx` 979 lines, `analytics/page.tsx` 923 lines, `intake/page.tsx` 728 lines).
2. A thin test layer (5 unit-test files; smoke scripts are the protective layer).
3. Stale documentation (README.md still says `npm`; some BLOCKERS.md "Open" items already closed by 7A.5).

Slice 7A.5 (Migration History Reconciliation) is in flight. Anything inside its perimeter (migrations, RLS, tenant scoping, captures actions, activity_events, rate limit, AI budget) is **off-limits** to autonomous changes. Document and surface; do not auto-fix.

---

## The 8 architecture documents (recommended read order)

1. **`system-map.md`** -- module map, route tree, dependency graph. Start here for orientation.
2. **`data-flow.md`** -- 9 traced end-to-end flows with Mermaid sequence diagrams (capture create, draft generate, approve-and-send, morning brief cron, intake, calendar sync, Resend webhook, campaign runner).
3. **`auth-flow.md`** -- middleware, three Supabase clients, tenantFromRequest, RLS philosophy. **Treat as immutable.**
4. **`dependency-analysis.md`** -- external integrations, internal cross-module imports, circular dep probe (clean), god-file scan, top components.
5. **`technical-debt-hotspots.md`** -- P0/P1/P2/P3 debt with DO NOT AUTO-FIX banners on the 7A.5 perimeter.
6. **`ai-agent-guide.md`** -- cold-start onboarding for the next agent (Claude, Cursor, GPT, Gemini).
7. **`AGENTS.md`** (at repo root) -- one-page contract.
8. **`PROJECT_CONTEXT.md`** (at repo root) -- business + product framing.

This document (`EXECUTIVE_SUMMARY.md`) is the ninth and links them all.

---

## Top 5 architectural risks

### 1. Service-role tenant scoping is convention-only (P0-3)

Every `adminClient.from(...)` call must include `.eq('user_id', ...)` or `.eq('account_id', ...)`. There is no compile-time enforcement. Forgetting once silently exposes a future second tenant's rows. Today's single-tenant deployment hides the bug class. **Fix:** lint rule that flags missing scope. Defer the implementation; document the rule.

### 2. Test coverage is thin (P1 systemic)

Five unit-test files (tenantFromRequest, intake/process, draftActions, rate-limit/check, weeklyWhere) cover the most critical business logic. UI components, route handlers, and integration paths are uncovered. The protective layer is `pnpm typecheck && pnpm build` plus the 59 smoke scripts in `scripts/`. **Fix:** a focused testing slice (Slice 8 candidate) adding Testing Library tests for the top 5 components and Playwright happy-path tests for capture create + email approve-and-send + intake submit.

### 3. AI budget guard fails open on RPC error (P0-7)

`_budget.checkBudget()` treats `current_day_ai_spend_usd` RPC failures as `spent_usd = 0`. Persistent RPC failure during a high-volume burst could exceed the daily budget without firing the warning event. **Fix:** Alex's call between fail-open (current, availability-first) and fail-closed (block on RPC error). Document the trade-off.

### 4. Today page is sparse since Slice 2A (P1-2)

Five today-page widgets (`tier-alerts`, `overdue-commitments`, `today-focus`, `recent-captures`, `week-stats`) were deleted in Slice 2A because they read from spine tables. Replacement widgets reading from `activity_events` are not yet built. The canonical morning surface is reduced. **Fix:** a Slice 2B follow-up that rebuilds the five widgets against the activity ledger.

### 5. Captures cleanup cron is not wired (P1-1)

`/api/captures/cleanup-audio` exists and deletes 30-day-old Storage objects, but `vercel.json` has no schedule. Audio files accumulate in Supabase Storage indefinitely. **Fix:** one-line addition to `vercel.json`.

---

## Top 5 opportunities

### 1. Tenant lint rule (small effort, large safety)

Catches the highest-risk bug class (service-role un-scoped query). Could be a custom ESLint rule in 50 lines. Pays compounding interest as the codebase grows.

### 2. Activity-event taxonomy is rich; build analytics on it

40 verbs, every side effect, all in one table. The `analytics/page.tsx` aggregation could pivot from per-domain queries to a single `activity_events` time-series with verb facets. Simpler code; richer charts; easier to add new dimensions.

### 3. shadcn Chart wrapper adoption

4-6 charts ship currently as direct Recharts. Wrapping in shadcn Chart standardizes tooltip styling, theming, dark-mode, and accessibility. Low-risk pass; cosmetics + a11y win.

### 4. Multi-tenant scaffold is ready -- second account is one row away

Slice 7A built the architecture for multi-tenant. The data is single-tenant. Adding a second `accounts` row + its `auth.users` row turns the system on for a new operator without architectural rewrite. The friction is in the UI (account picker, settings) and seed data, not the model.

### 5. Smoke scripts -> CI gates

`scripts/` carries 59 .mjs/.ts/.py smoke + debug scripts. None are wired to CI. Promoting the slice-level smokes (`slice7a-smoke.mjs`, `slice5b-smoke.mjs`, `phase-9-realtime-smoke.mjs`) to GitHub Actions would catch regressions per-commit. The work is config, not code.

---

## Top 5 easiest wins

### 1. Add `captures/cleanup-audio` cron (5 minutes)

One JSON entry in `vercel.json`. Confirms `CRON_SECRET` is set. Closes BLOCKERS entry 2026-04-23.

### 2. README.md modernization (15 minutes)

Replace `npm` -> `pnpm`. Update Phase 1 features list (drop `follow_ups`, `deals`; mention activity_events). Refresh demo seed instructions.

### 3. `materials/` -> `tickets/` directory rename (10 minutes)

Slice 3B renamed the table and route but not the component directory. `git mv src/components/materials src/components/tickets` plus path updates is a single PR. Removes vocabulary drift.

### 4. Delete legacy `lib/temperature.ts` (5 minutes)

`lib/scoring/temperature.ts` is the canonical one. The top-level file is unused. Verify zero imports, delete.

### 5. Refresh `~/.claude/rules/dashboard-architecture.md` "deals + opportunities" section

The rule says deals + opportunities are both first-class. Slice 2C dropped deals. The rule is stale. Surface to Alex; the rule file is outside this architecture pass's scope, so we can't update it directly.

---

## Long-term scalability concerns

### Concern 1: Single-database, single-region

Supabase project + Vercel deployment are single-region. Phoenix-based operator + agents in the Valley make this fine today. A second operator on a different timezone is the first stress; a second region is far away.

### Concern 2: All cron work runs in the same Next app

9 crons fire from the same Next.js project. A long-running cron (campaign-runner with 50 enrollments) blocks the function until it returns. Vercel function timeout (60s default for Pro) is the ceiling. If campaign volume grows, expect to split crons into a worker (Vercel Functions or a Supabase Edge Function) before the timeout bites.

### Concern 3: AI budget is a single-day cap

`AI_DAILY_BUDGET_USD` is one number. As capabilities grow (morning brief, capture parse, draft revise, inbox score, plus future capabilities), per-feature caps would help isolate bursts. Defer until an actual burst happens.

### Concern 4: Activity events grow unbounded

Every side effect writes one row. After a year at ~50 events/day per operator, the table is ~18k rows. After 5 years and 5 operators, it's ~450k rows. Index on `(user_id, occurred_at desc)` keeps reads fast, but archival policy is not yet defined. Defer to operational maturity.

### Concern 5: Realtime subscriptions are scoped to single tables

`email_drafts` has Realtime; other latency-sensitive tables don't yet. As Today-v2 mutations land (Phase 008 explicitly deferred them), Realtime expansion is the next step. Pattern is documented in `~/crm/docs/supabase-realtime-pattern.md`.

---

## Highest-leverage improvements (ranked)

In order of impact-per-hour:

| Rank | Improvement | Effort | Impact |
|---|---|---|---|
| 1 | Tenant scope lint rule (P0-3 fix) | 1-2 hrs | Catches a P0 bug class permanently |
| 2 | Today page widget rebuild (P1-2) | 1-2 days | Restores canonical morning surface |
| 3 | `captures/cleanup-audio` cron (P1-1) | 5 min | Closes Storage cost surface |
| 4 | Smoke scripts -> GitHub Actions CI | 4 hrs | Per-commit regression catch |
| 5 | Top-5 component Testing Library coverage | 1-2 days | Reduces UI regression risk |
| 6 | shadcn Chart wrapper adoption | 4 hrs | Standardizes 4-6 charts; a11y win |
| 7 | README.md + `~/.claude/rules/dashboard-architecture.md` refresh | 1 hr | Removes false signals for future agents |
| 8 | `task-list.tsx` decomposition | 1-2 days | High-traffic file becomes maintainable |
| 9 | `materials/` -> `tickets/` directory rename | 30 min | Removes vocabulary drift |
| 10 | Legacy `lib/temperature.ts` delete | 5 min | One less stale file |

The first three are short, high-leverage, and unblock the next layer.

---

## Handoff notes

For the next agent (Claude, Cursor, human) landing on this codebase:

1. **Read `AGENTS.md` and `PROJECT_CONTEXT.md` first.** Then this summary. Then the architecture doc that matches your task.
2. **Slice 7A.5 is in flight.** Treat the auth + migrations + activity-ledger + AI-budget perimeter as off-limits. Document, surface, do not auto-fix.
3. **Verify before claiming done:** `cd ~/crm && pnpm typecheck && pnpm build`. Both must pass.
4. **GSD inside `~/crm/` replaces `/lock`.** `/gsd-plan-phase` -> wait for "lock it" or "go" -> `/gsd-execute-phase`.
5. **Never reintroduce extinct patterns:** `OWNER_USER_ID`, `ALEX_EMAIL`, email-based RLS, spine tables, `material_requests` table reference, `deals` table, `follow_ups` table, `lib/spine` namespace.
6. **Banned providers:** Twilio / SMS, Zapier / Make / n8n, Stripe, Mailerlite, Vercel KV/Edge Config/Blob, Sentry/PostHog/Datadog. If a request needs one, surface the conflict.
7. **No em dashes.** Hooks at `~/.claude/hooks/em-dash-check.sh` block writes.

The most useful single file for understanding the system is `data-flow.md` -- the 9 traced flows give you the full transaction shape without reading code.

The most useful single file for staying out of trouble is `auth-flow.md` -- the perimeter is documented file by file.

---

## Document inventory

Generated by this pass:

| File | Path | Approx lines | Reading time |
|---|---|---|---|
| System map | `docs/architecture/system-map.md` | ~600 | 10 min |
| Data flow | `docs/architecture/data-flow.md` | ~600 | 12 min |
| Auth flow | `docs/architecture/auth-flow.md` | ~500 | 10 min |
| Dependency analysis | `docs/architecture/dependency-analysis.md` | ~500 | 8 min |
| Technical debt hotspots | `docs/architecture/technical-debt-hotspots.md` | ~600 | 10 min |
| AI agent guide | `docs/architecture/ai-agent-guide.md` | ~600 | 10 min |
| Executive summary (this file) | `docs/architecture/EXECUTIVE_SUMMARY.md` | ~400 | 6 min |
| AGENTS.md | `AGENTS.md` | ~250 | 4 min |
| PROJECT_CONTEXT.md | `PROJECT_CONTEXT.md` | ~250 | 4 min |

Total: ~4,300 lines of documentation, ~74 minutes of reading. The full pack is also mirrored to `~/Desktop/gat-bos-architecture-2026-05-01/` for offline reference.

---

## What this pass did NOT change

- Zero source files modified. `src/`, `supabase/`, `scripts/`, `vercel.json`, `package.json`, `next.config.mjs`, `middleware.ts`, all auth files: untouched.
- Zero migrations created or modified. Slice 7A.5 owns the migration ledger.
- Zero commits. Alex commits when he reviews.
- Zero environment variables changed.
- Zero deploys.

The only changes on disk are nine new markdown files (the eight architecture docs above plus this summary), `AGENTS.md` and `PROJECT_CONTEXT.md` at the repo root, plus a Desktop mirror folder.

---

## Verification (run by this pass)

| Check | Result |
|---|---|
| All 9 architecture files exist and non-empty | confirmed at write time |
| `AGENTS.md` and `PROJECT_CONTEXT.md` exist at repo root | confirmed |
| No source-file modifications | scripts directory unchanged; src/ unchanged |
| No new migrations | `supabase/migrations/` unchanged |
| No em dashes in any new doc | enforced by `~/.claude/hooks/em-dash-check.sh` (blocks at write time) |
| No banned-provider recommendations | grep clean against twilio / zapier / sms |
| Cross-references valid | every `cross-references` link points to a file written this pass |
| No commits made | `git status` will show only new files |

The handoff is clean. Read this summary, drill in, ship in the morning.
