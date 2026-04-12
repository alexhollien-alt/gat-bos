# CRM Documentation Index

Generated 2026-04-11. All docs validated against actual code in
`~/crm/src/` and `~/crm/supabase/`.

## Architecture and database

- [dashboard-sql-pieces.md](./dashboard-sql-pieces.md) -- The four idempotent SQL migrations (piece 1 rename, piece 2 infrastructure, piece 3 smart coalesce view, piece 4 follow_ups table)
- [agent-relationship-health-materialized-view.md](./agent-relationship-health-materialized-view.md) -- Server-side health score computation algorithm (40/30/20/10 weighted), refresh triggers, and client consumption pattern

## API layer

- [api-routes.md](./api-routes.md) -- Complete reference for every route under `src/app/api/` (contacts, intake, transcribe, email test, resend webhook)
- [auth-middleware.md](./auth-middleware.md) -- `middleware.ts` flow, why `/api/*` and `/intake` are skipped, cookie refresh pattern
- [intake-route-contact-auto-create.md](./intake-route-contact-auto-create.md) -- Deep dive on the public intake POST flow, contact lookup, auto-create, material_requests fan-out
- [resend-email-integration.md](./resend-email-integration.md) -- `sendEmail` helper with staging lock, webhook receiver that bumps health scores on open/click events

## Frontend and state

- [tanstack-query-provider.md](./tanstack-query-provider.md) -- Single QueryClient setup, default staleTime, per-data-type stale overrides, realtime invalidation contract
- [supabase-realtime-pattern.md](./supabase-realtime-pattern.md) -- Canonical `postgres_changes` channel pattern, query invalidation discipline, cleanup rules
- [command-palette.md](./command-palette.md) -- Cmd+K palette (cmdk via shadcn), fuzzy contact search, quick action shortcuts

## Dashboard widgets

- [dashboard-page-layout.md](./dashboard-page-layout.md) -- Top-level `/dashboard` route composition, two-column grid, nine rendered widgets, known `c.relationship` vs `c.stage` bug
- [task-list-widget.md](./task-list-widget.md) -- The Tier 1 Linear Focus widget with six buckets, per-bucket query keys, realtime invalidation for four tables

## Utilities

- [action-scoring.md](./action-scoring.md) -- 0-100 action ranking formula (type + tier + overdue + health), tier-specific stale thresholds, used by `/actions` page
- [temperature-coalescing.md](./temperature-coalescing.md) -- Merge Alex's `rep_pulse` gut call with system `health_score`, 14-day freshness window, divergence flagging

## What was not documented

The following priority targets from the assignment could not be
documented because the files do not exist in the current `~/crm/`
checkout (branch memory indicates they live on `feat/spine-phase1`):

- Spine Phase 1 routes `(app)/today`, `(app)/capture`, `(app)/inbox`,
  `(app)/commitments`
- Bento grid layout system via `grid-template-areas`. Current dashboard
  uses Tailwind `grid-cols-1 lg:grid-cols-3` as a simpler static grid.
- shadcn Chart components. Recharts is used directly in
  `components/dashboard/campaign-timeline.tsx` and
  `app/(app)/analytics/page.tsx` without the shadcn Chart wrapper.

## Existing pre-authored docs (not regenerated)

- `analytics-use-cases.md`
- `plans/2026-04-03-contacts-api-skill-wiring.md`
- `plans/gatbos-reconciliation-plan.md`
- `plans/gatbos-rollback-2026-04-10.md`
- `superpowers/plans/2026-04-07-spine-phase1-ship.md`
- `superpowers/specs/2026-04-07-spine-today-command-design.md`
