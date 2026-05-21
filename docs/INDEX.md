# CRM Documentation Index

Last updated 2026-05-20 by `/autoresearch:learn --mode update`. Cross-validated against `~/crm/src/`, `~/crm/supabase/migrations/`, and `~/crm/vercel.json`.

For the moving build log, see `BUILD.md` at repo root. For open blockers, see `BLOCKERS.md`.

---

## Architecture (read in order)

The 2026-05-01 architecture pass, regenerated as the system evolves.

1. [architecture/EXECUTIVE_SUMMARY.md](./architecture/EXECUTIVE_SUMMARY.md) -- TL;DR, top risks, opportunities, easiest wins
2. [architecture/system-map.md](./architecture/system-map.md) -- Structural index: routes, 26 lib modules, 18 component buckets, 9 cron jobs, migrations layout
3. [architecture/data-flow.md](./architecture/data-flow.md) -- Write paths, the `activity_events` sink, read projections, realtime invalidation
4. [architecture/auth-flow.md](./architecture/auth-flow.md) -- Session/cron/webhook/token auth modes, tenant scoping, env contract
5. [architecture/ai-agent-guide.md](./architecture/ai-agent-guide.md) -- Claude wrapper, AI budget guard, morning brief composition
6. [architecture/dependency-analysis.md](./architecture/dependency-analysis.md) -- Cross-module dependency graph
7. [architecture/technical-debt-hotspots.md](./architecture/technical-debt-hotspots.md) -- Risk and refactor candidates

## Infrastructure and operations

Generated 2026-05-08 from the plumbing audit pass.

- [infrastructure/PRIORITY_ACTION_PLAN.md](./infrastructure/PRIORITY_ACTION_PLAN.md) -- Ranked remediation order across reliability, security, observability
- [infrastructure/plumbing-audit.md](./infrastructure/plumbing-audit.md) -- End-to-end plumbing review
- [infrastructure/reliability-report.md](./infrastructure/reliability-report.md) -- Cron idempotency, retry, failure-mode analysis
- [infrastructure/security-audit.md](./infrastructure/security-audit.md) -- RLS scope, service-role usage, webhook HMAC, token surface
- [infrastructure/observability-gaps.md](./infrastructure/observability-gaps.md) -- Missing logs, metrics, error sinks
- [infrastructure/test-coverage-report.md](./infrastructure/test-coverage-report.md) -- Test surface inventory and gaps
- [infrastructure/high-risk-areas.md](./infrastructure/high-risk-areas.md) -- Hot spots for breakage
- [infrastructure/handoff-notes.md](./infrastructure/handoff-notes.md) -- Context for next operator

### Proposed patches

- [infrastructure/proposed-patches/README.md](./infrastructure/proposed-patches/README.md) -- Patch index
- [infrastructure/proposed-patches/03-route-validation-patterns.md](./infrastructure/proposed-patches/03-route-validation-patterns.md)
- [infrastructure/proposed-patches/04-cron-idempotency-checklist.md](./infrastructure/proposed-patches/04-cron-idempotency-checklist.md)
- [infrastructure/proposed-patches/06-route-auth-test.md](./infrastructure/proposed-patches/06-route-auth-test.md)
- [infrastructure/proposed-patches/07-error-log-helper.md](./infrastructure/proposed-patches/07-error-log-helper.md)

## API layer

- [api-routes.md](./api-routes.md) -- Reference for routes under `src/app/api/` (contacts, intake, transcribe, email, resend webhook)
- [auth-middleware.md](./auth-middleware.md) -- `middleware.ts` flow, `/api/*` and `/intake` bypass, cookie refresh
- [intake-route-contact-auto-create.md](./intake-route-contact-auto-create.md) -- Public intake POST, contact lookup, auto-create, material_requests fan-out
- [resend-email-integration.md](./resend-email-integration.md) -- `sendEmail` helper with staging lock, webhook receiver, open/click event handling

## Frontend and state

- [tanstack-query-provider.md](./tanstack-query-provider.md) -- QueryClient setup, per-data-type `staleTime`, realtime invalidation contract
- [supabase-realtime-pattern.md](./supabase-realtime-pattern.md) -- `postgres_changes` channel pattern, invalidation discipline, cleanup
- [command-palette.md](./command-palette.md) -- Cmd+K palette (cmdk + shadcn), fuzzy contact search, quick actions
- [dashboard-page-layout.md](./dashboard-page-layout.md) -- `/dashboard` composition, two-column grid, widget inventory

## Dashboard, scoring, health

- [task-list-widget.md](./task-list-widget.md) -- Tier 1 Linear Focus widget, six buckets, per-bucket query keys
- [action-scoring.md](./action-scoring.md) -- 0-100 action ranking (type + tier + overdue + health), tier-specific stale thresholds
- [agent-relationship-health-materialized-view.md](./agent-relationship-health-materialized-view.md) -- Server-side 40/30/20/10 health score, refresh triggers, client consumption
- [temperature-coalescing.md](./temperature-coalescing.md) -- Merge `rep_pulse` gut call with `health_score`, 14-day freshness window, divergence flag
- [dashboard-sql-pieces.md](./dashboard-sql-pieces.md) -- Idempotent dashboard SQL migrations
- [analytics-use-cases.md](./analytics-use-cases.md) -- Activity event analytics surface

## Domain systems

- [revenue-automation-engine.md](./revenue-automation-engine.md) -- Campaign + drip + signal + lifecycle architecture (load before touching campaign/drip features)

### Task system

- [task-system/setup.md](./task-system/setup.md) -- Phase 0 schema + capture endpoint setup
- [task-system/claude-project-prompt.md](./task-system/claude-project-prompt.md) -- Anthropic project prompt for task triage
- [task-system/projection-rebuild.md](./task-system/projection-rebuild.md) -- Read-model rebuild procedure

## Plans and specs (historical, scoped per-slice)

### Recent plans

- [plans/gatbos-reconciliation-plan.md](./plans/gatbos-reconciliation-plan.md)
- [plans/gatbos-rollback-2026-04-10.md](./plans/gatbos-rollback-2026-04-10.md)
- [plans/2026-04-03-contacts-api-skill-wiring.md](./plans/2026-04-03-contacts-api-skill-wiring.md)

### Superpowers plans

- [superpowers/plans/2026-04-13-phase1-inbox-queue.md](./superpowers/plans/2026-04-13-phase1-inbox-queue.md)
- [superpowers/plans/2026-04-12-session1-unblock-everything.md](./superpowers/plans/2026-04-12-session1-unblock-everything.md)
- [superpowers/plans/2026-04-07-spine-phase1-ship.md](./superpowers/plans/2026-04-07-spine-phase1-ship.md) (spine deprecated as of Slice 2A, retained for history)
- [superpowers/plans/2026-04-07-voice-memo-capture.md](./superpowers/plans/2026-04-07-voice-memo-capture.md)
- [superpowers/plans/2026-04-07-phase2.1-contacts-rls-and-api-token.md](./superpowers/plans/2026-04-07-phase2.1-contacts-rls-and-api-token.md)
- [superpowers/plans/2026-04-06-digital-aesthetic-v2-polish.md](./superpowers/plans/2026-04-06-digital-aesthetic-v2-polish.md)
- [superpowers/plans/2026-04-05-crm-phase5-operations.md](./superpowers/plans/2026-04-05-crm-phase5-operations.md)

### Superpowers specs

- [superpowers/specs/2026-04-13-ultraplan-v2-resequenced.md](./superpowers/specs/2026-04-13-ultraplan-v2-resequenced.md)
- [superpowers/specs/2026-04-12-ultraplan-design.md](./superpowers/specs/2026-04-12-ultraplan-design.md)
- [superpowers/specs/2026-04-07-spine-today-command-design.md](./superpowers/specs/2026-04-07-spine-today-command-design.md) (spine deprecated, retained for history)

---

## Conventions

- Architecture docs are read-only outputs of periodic passes -- regenerate, don't hand-edit unless the underlying surface moved
- Infrastructure docs are review outputs -- close items by linking the PR that resolved them
- Plans/specs are time-stamped artifacts; do not retroactively edit (date in filename is canonical)
- The `activity_events` table is the canonical write target from Slice 1 onward (per repo `CLAUDE.md`)
- Migrations: `supabase migration new <name>` then `supabase db push`. Never paste raw SQL.
