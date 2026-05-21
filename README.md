# GAT-BOS CRM

Single-operator CRM for Alex Hollien at Great American Title Agency. Tracks the universe of Phoenix-area real estate agents, ingests communications (Gmail, Calendar, voice and text captures, intake form), and triages follow-up across an AI-assisted surface.

Not a public product. Single-tenant in practice, multi-tenant in schema design.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS v3 + shadcn/ui v4
- Supabase (Auth + Postgres + Realtime)
- TanStack Query v5 + dnd-kit + cmdk + Recharts
- React Hook Form + Zod
- Anthropic SDK + OpenAI SDK (Whisper)
- Resend (transactional + Weekly Edge)
- Vitest + Playwright + Lighthouse
- pnpm (never npm or yarn)

See `package.json` for full dependency list.

## Setup

### 1. Link the Supabase project

```bash
supabase link --project-ref <your-project-ref>
```

All schema work flows through the Supabase CLI. Direct SQL Editor use is retired.

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

At minimum, fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Additional keys (Resend, Anthropic, OpenAI, Google OAuth) gate their respective integrations. See `docs/architecture/auth-flow.md` for the full env contract.

For Vercel-managed envs:

```bash
vercel env pull --environment=preview
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Apply migrations

```bash
supabase db push
```

121 migrations live under `supabase/migrations/`. Schema is idempotent; reruns are safe.

### 5. Generate Supabase types

```bash
supabase gen types typescript --linked > src/lib/supabase/types.ts
```

Regenerate after every schema change.

### 6. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). If 3000 is occupied, Next.js auto-increments to 3001.

### 7. Verify the build

```bash
pnpm typecheck && pnpm build
```

Both must pass before any commit. See `CLAUDE.md` for the canonical pre-commit gate.

## Current surface

Authenticated app under `src/app/(app)/`:

- `dashboard/` -- bento grid widgets, relationship health, KPI cards
- `today/` and `today-v2/` -- prioritized action queue (Linear Focus model), runway authoring, CallRow UX with toasts and undo
- `contacts/` -- searchable agent universe with timeline, opportunities, deals, tasks tabs
- `opportunities/` and `deals/` -- pipeline (dollar volume) and closing-date workstreams; not synonyms, see `~/.claude/rules/dashboard-architecture.md`
- `tasks/` -- task system phase 0 schema + capture endpoint
- `inbox/` -- Gmail-scanned items awaiting triage
- `captures/` -- universal capture bar inbound (text + voice + intake)
- `morning/` -- AI morning brief (Edge function, cached 1h)
- `weekly-edge/` and `drafts/` -- assemble + send pipeline, approve gate, telemetry
- `campaigns/` -- drip + nurture orchestration
- `material-requests/` and `materials/` -- marketing collateral fulfilment
- `projects/` -- agent-scoped project tracking with touchpoint cadence
- `analytics/` -- activity event dashboards
- `actions/` -- 0-100 ranked next-action list

Public surfaces:

- `intake/` -- public agent intake form (rate-limited)
- `agents/[slug]/` and `agent/[token]/` -- agent portal (token-gated read-only, Slice 7C)
- `portal/[slug]/` -- redeemable invite portal

API layer: 30 route handlers under `src/app/api/` across 11 functional groups. 9 cron jobs in `vercel.json` (morning brief, weekly edge assemble + send, gmail sync, calendar sync, health score recompute, touchpoint reminders, captures cleanup, campaign runner).

For the moving build state, read `BUILD.md` at repo root.
For known broken integrations, read `BLOCKERS.md`.

## Architecture

Read in order:

1. `docs/architecture/EXECUTIVE_SUMMARY.md` -- TL;DR + top risks/opportunities/wins
2. `docs/architecture/system-map.md` -- structural index of routes, lib modules, components, cron, migrations
3. `docs/architecture/data-flow.md` -- write paths, the `activity_events` sink, read projections
4. `docs/architecture/auth-flow.md` -- session + cron + webhook + token auth modes; tenant scoping
5. `docs/architecture/ai-agent-guide.md` -- Claude wrapper, AI budget, morning brief composition
6. `docs/architecture/dependency-analysis.md` -- cross-module graph
7. `docs/architecture/technical-debt-hotspots.md` -- where risk and refactor candidates live

Operational deep dives live under `docs/infrastructure/`; doc index at `docs/INDEX.md`.

## Project structure

```
src/
  app/
    (app)/         Authenticated app surface (see "Current surface")
    (auth)/        Login + signup
    api/           30 route handlers, 11 functional groups
    agents/        Public agent profile pages
    agent/         Token-gated agent portal
    intake/        Public intake form
    portal/        Invite redemption
  components/      18 buckets (ui/, tickets/, interactions/, tasks/, ...)
  lib/             26 domain modules (activity/, ai/, contacts/, opportunities/, ...)
supabase/
  migrations/      121 timestamped SQL migrations
audits/            Brand + truth + surface + skills + rules audit framework
scripts/           Smoke + debug + build helpers
docs/              Architecture, infrastructure, task-system, plans, superpowers
.planning/         GSD execution protocol (overrides /lock inside ~/crm/)
```

## Working in this repo

- Every session classifies as **build** or **plumbing**. Read `BUILD.md` (what we're building) and `BLOCKERS.md` (broken integrations) before starting.
- Build sessions ship UI/copy/features. Plumbing sessions fix integrations.
- Mid-build blockers: hardcode a fallback, log to `BLOCKERS.md`, keep building.
- GSD protocol (`/gsd-plan-phase`, `/gsd-execute-phase`) replaces `/lock` inside this repo.
- Migrations: `supabase migration new <name>` then `supabase db push`. Never paste raw SQL into Supabase Studio.
- Verify before done: `pnpm typecheck && pnpm build`.

Full conventions in `CLAUDE.md` at repo root.
