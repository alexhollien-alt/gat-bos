# Handoff Notes -- 2026-05-01 Overnight Infrastructure Audit

**Operator:** autonomous overnight session
**Started:** 2026-05-01 ~00:25 (after 7A.5 reconciliation snapshot)
**Branch on entry:** `gsd/016-slice-7a5-migration-reconciliation`
**Branch on exit:** same (no commits made)
**Plan file:** `~/.claude/plans/cheeky-doodling-hartmanis.md` (locked + executed)

---

## What was audited

Read-only inspection across the GAT-BOS CRM at `~/crm/`, scoped to the surface area outside the active 7A.5 migration reconciliation. Specifically:

- 31 API route handlers (representative read-through; not exhaustive).
- `src/middleware.ts`, `src/lib/api-auth.ts`, `src/lib/auth/tenantFromRequest.ts` (read-only).
- `src/lib/error-log.ts`, `src/lib/rate-limit/check.ts`, `src/lib/ai/_budget.ts`.
- `/api/intake/route.ts`, `/api/cron/campaign-runner/route.ts`, `/api/webhooks/resend/route.ts` end-to-end.
- `vercel.json` cron schedule (9 entries, 7 routes).
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.eslintrc.json`.
- `.env.local` keys (no values).
- `.gitignore`.
- 91 migration filenames (NOT contents -- read-only listing only, since migrations are inside the 7A.5 hands-off zone).

---

## What was changed

### In `~/crm/`:

Only **new files**, all under `~/crm/docs/infrastructure/`:

```
docs/infrastructure/
  security-audit.md
  plumbing-audit.md
  reliability-report.md
  observability-gaps.md
  high-risk-areas.md
  test-coverage-report.md
  PRIORITY_ACTION_PLAN.md
  handoff-notes.md           (this file)
  proposed-patches/
    README.md
    01-env-example.diff
    02-env-loader.diff
    03-route-validation-patterns.md
    04-cron-idempotency-checklist.md
    05-error-boundaries.diff
    06-route-auth-test.md
    07-error-log-helper.md
    08-nvmrc-engines.diff
    09-ci-workflow.diff
```

Total: 18 new files. Zero existing files edited.

### In `~/.claude/`:

Only the plan file: `~/.claude/plans/cheeky-doodling-hartmanis.md` (created at plan-mode start).

---

## What was intentionally NOT changed

Per the plan's hands-off list:

- `~/crm/supabase/**` -- all 91 migrations, RLS policies, staged renames, untracked files.
- `~/crm/src/middleware.ts`.
- `~/crm/src/lib/auth/tenantFromRequest.ts` and `__tests__/`.
- `~/crm/src/lib/api-auth.ts`.
- `~/crm/src/lib/activity/{writeEvent.ts, types.ts, queries.ts}`.
- `~/crm/src/lib/captures/{actions.ts, rules.ts, queries.ts, types.ts}`.
- `~/crm/src/lib/rate-limit/check.ts`.
- `~/crm/src/lib/supabase/{server.ts, client.ts, admin.ts}`.
- `~/crm/src/app/api/auth/gmail/**`.
- `~/crm/.planning/**`.
- `~/crm/audit/2026-04-slice7a-migration-reconciliation/**`.
- `~/crm/SCHEMA.md`, `ROADMAP.md`, `BACKLOG.md`, `BLOCKERS.md`, `LATER.md`, `friction-log.md`.
- `~/crm/scripts/**` (no scripts run; live-infra probe risk).

Verified via `git status --short` at handoff: every file under `supabase/`, `src/`, `scripts/`, `.planning/`, root markdown files reflects exactly the same state as session entry (the staged 7A.5 reconciliation work is untouched).

---

## Gates run + results

| Gate | Result | Captured at |
|------|--------|-------------|
| `pnpm typecheck` (entry) | PASS | `/tmp/audit-2026-05-01/typecheck.txt` |
| `pnpm typecheck` (exit) | PASS | re-run at handoff |
| `pnpm lint` (entry) | PASS | `/tmp/audit-2026-05-01/lint.txt` |
| `pnpm lint` (exit) | PASS | re-run at handoff |
| `pnpm test --coverage` | 5 files / 101 tests / all PASS / 9.26% line coverage | `/tmp/audit-2026-05-01/test-coverage.txt` |
| `pnpm audit --json` | 3 high, 14 moderate, 0 critical | `/tmp/audit-2026-05-01/pnpm-audit.json` |
| `pnpm outdated` | 19 packages have newer versions; Next.js 2 majors behind | `/tmp/audit-2026-05-01/pnpm-outdated.txt` |
| `git status --short` (entry) | 40+ staged renames + 5 modified migrations + 4 untracked migrations + 3 deleted RLS files (all pre-session 7A.5 work) | `/tmp/audit-2026-05-01/git-status.txt` |
| `git status --short` (exit) | Same as entry, plus `?? docs/infrastructure/` (new) | live `git status` at handoff |

---

## Findings rolled up

8 HIGH, 0 CRITICAL. Full list in `PRIORITY_ACTION_PLAN.md`. Top three by exposure:

1. **`OPENAI_API_KEY` is referenced by `/api/transcribe/route.ts` but missing from `.env.local`.** Voice-capture transcription returns 500 in prod on first request. Fix: land `.env.example` (drafted at `proposed-patches/01-env-example.diff`).
2. **No error boundary in the App Router.** Uncaught server-component errors render Next's default UI; uncaught root-layout errors take down the app. Fix: drafted at `proposed-patches/05-error-boundaries.diff`.
3. **Three high-severity npm advisories (CVE-2025-64756 glob, CVE-2024-50383 next, CVE-2025-24761 next).** Next.js is two majors behind. Fix: post-7A.5 dedicated upgrade session.

---

## Findings routed to proposed patches (count = 9)

| Patch | Source finding(s) | Status |
|-------|-------------------|--------|
| 01 .env.example | S1, A1 | Ready to land |
| 02 src/lib/env.ts | S2, P1, A9 | Ready to land |
| 03 Per-route zod | P3, A8 | Sketch only |
| 04 Cron idempotency | R1, A5 | Sketch only |
| 05 Error boundaries | R4, A2 | Ready to land |
| 06 Route-auth CI test | S5, A3 | Sketch only |
| 07 withErrorLog helper | O2, A13 | Sketch only |
| 08 .nvmrc + engines | A10 | Ready to land |
| 09 CI workflow | A14 | Ready to land |

"Ready to land" = patch contains the literal file content. Alex copies the content to the target path and commits on a fresh post-7A.5 branch.
"Sketch only" = patch is a prose design + reference snippets; needs Alex's engineering judgment to flesh out before landing.

---

## What needs Alex approval

In priority order (ready-to-land first):

1. **Apply Patch 01 (.env.example)** -- single new file at repo root. No existing edits. Zero risk.
2. **Apply Patch 08 (.nvmrc + engines)** -- single new file + 1 line in package.json. Confirms the Node version Vercel uses.
3. **Apply Patch 05 (error boundaries)** -- two new files at `src/app/error.tsx` and `src/app/global-error.tsx`. Review the recover-friendly UI copy / styling first.
4. **Apply Patch 09 (CI workflow)** -- single new file at `.github/workflows/ci.yml`. Confirms CI gates first PR after landing.
5. **Apply Patch 02 (env loader)** -- single new file at `src/lib/env.ts`. Existing 52 sites unchanged; migrate on next-touch.
6. **Schedule Patches 03, 04, 06, 07 sketches into the post-7A.5 backlog** -- each becomes its own dedicated PR.
7. **Schedule Next.js 14 -> 16 upgrade** (PRIORITY_ACTION_PLAN A4) -- 1-2 day session post-7A.5.
8. **Schedule schema-dependent fixes A5, A6, A20** -- queue behind 7A.5 lands.

---

## Other untracked artifacts NOT touched

`git status --short` at handoff also shows two untracked directories that this session did NOT create or modify:

- `docs/architecture/` (auth-flow.md, data-flow.md, dependency-analysis.md, system-map.md, technical-debt-hotspots.md)
- `docs/executive/` (8 files including overnight-agent-handoff.md, ai-agent-improvement-plan.md, next-90-days-roadmap.md, future-automation-roadmap.md, highest-leverage-opportunities.md, manual-work-elimination.md, system-friction-analysis.md, v1-to-v2-strategy.md)

File timestamps show these dirs were populated during the same window as my session, but **nothing in this session wrote to them**. Filenames suggest a parallel autonomous agent run focused on architecture mapping and executive strategy, not infrastructure plumbing. Treat as another agent's output. This audit's deliverables are scoped exclusively to `docs/infrastructure/` (8 docs + 10 proposed-patches files).

`docs/business/` was already untracked at session entry (also not mine).

The 4 untracked migrations under `supabase/migrations/` (`20260410000050_local_seed_alex_auth_user.sql`, `20260427299500_create_missing_tables_from_prod_mirror.sql`, `20260427299600_create_missing_functions_from_prod_mirror.sql`, `20260430999700_slice7a5_full_prod_mirror.sql`) are part of the active 7A.5 reconciliation work and were NOT inspected, modified, or staged by this session.

---

## Standing-rule conformance

- Rule 1 (fill and flag): every doc lists "Remaining placeholders" at the end; all are "None."
- Rule 2 (no em dashes): docs use double hyphens. Verified by spot-grep.
- Rule 3 (no hard deletes): zero destructive operations.
- Rule 5 (consequence gate): zero production writes, zero deploys, no commits, no schema changes.
- Rule 16 (verify external audits): the recon-agent maps used in this audit were validated against `git status`, live `ls`, and direct file reads before being incorporated into findings.
- Rule 18 (auto-open): n/a; audit docs are markdown for review, not visual deliverables.
- Rule 23 (Supabase CLI exclusive): zero SQL drafted or run; zero `mcp__supabase__*` calls; zero new `PASTE-INTO-SUPABASE-*.sql` paste-files.

---

## Recommended next session

Plumbing-only post-7A.5 session, scoped to:

1. Confirm 7A.5 reconciliation is closed and merged.
2. Apply Patches 01, 08, 05, 09, 02 in that order on a single `infra/post-7a5-cleanup` branch.
3. Verify `pnpm typecheck && pnpm build && pnpm lint && pnpm test --coverage` all pass.
4. Open PR; merge after CI green.
5. Begin scheduling A4 (Next.js upgrade) for a separate dedicated session.

---

## Open issues / blockers from this audit

None. The audit ran end-to-end without hitting a halt condition.

Two findings flagged uncertainty that should be resolved in a follow-up read-only pass:

- The body-validation status of ~15 of 31 API routes is UNKNOWN (deferred). Per-route deep dive recommended (PRIORITY_ACTION_PLAN A15).
- `src/lib/retry.ts` exists, has 0% coverage, and was not inspected. Read-only confirmation pending (A18).

Neither blocks 7A.5 landing.

---

## Remaining placeholders

- None.
