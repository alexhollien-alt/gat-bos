# GAT-BOS

## What This Is

GAT-BOS is the Great American Title Business Operating System, a purpose-built CRM for Alex Hollien, a Title Sales Executive in the Phoenix Valley. It tracks real estate agents as contacts, transactions across both pipeline (opportunities) and closings (deals), interactions and tasks per agent, and the marketing deliverables that keep relationships warm. The system is a single-operator tool, not a multi-tenant SaaS; the operator is the marketing department for a roster of agents.

## Core Value

Keep agent relationships warm and transactions on track, so that "the transaction the client was promised is the transaction they experience." If everything else fails, the Today View must surface the right next action for the right agent at the right time.

## Requirements

### Validated

<!-- Shipped through milestone v1.0 (phases 001-022 plus task-system-phase-0 work-in-flight). Inferred from .planning/phases/ history. -->

- ✓ activity_events ledger as canonical write target, Slice 1 (phases 001-005)
- ✓ Spine drop (deprecating spine_inbox / commitments / signals / focus_queue / cycle_state), Slice 2a (phase 002)
- ✓ Captures consolidation, Slice 2b (phase 003)
- ✓ Tasks, opportunities, interactions data model, Slice 2c (phase 004)
- ✓ Interactions routes cleanup, Slice 3 (phase 005)
- ✓ Ticket unification + OAuth cleanup + lib carryforward, Slice 3b (phase 007)
- ✓ Today V2 live bind, phase 008
- ✓ Agent portal magic-link invite + slice 7C routes, phases 015 + phase 5 of Slice 7
- ✓ Weekly Edge assemble + send + review pipeline, phase 020
- ✓ Cron registration + first live dry-run, phase 021
- ✓ Altos pull + upsert fix, phase 022
- ✓ Activity events Phase 1-5 (PRs #44 #45 #46 #47, .claude commit 9b7f332), shipped 2026-05-11
- ✓ Typography rebuild (Cal Sans + PT Sans + Great Day kit), shipped 2026-05-08
- ✓ Color palette rebuild (4-role system palette: Ground / Structure / Signal / Atmosphere), shipped 2026-05-08
- ✓ CRM visual elevation (5 phases, commit ae15619), shipped 2026-04-16
- ✓ Impeccable P0 sweep on task-system-phase-0 (PR #50), shipped 2026-05-21

### Active

<!-- Current scope: Milestone v2.0 Design Overhaul -->

- [ ] Audit every CRM / website surface against the locked Direction B Concierge spec
- [ ] Audit every production email template (Weekly Edge, Closing Brief, Monthly Toolkit, Partner Spotlight) against the locked spec
- [ ] Audit every recent flyer for structural integrity (Phase 0 check) before any creative critique
- [ ] Synthesize cross-surface patterns and produce a master fix plan
- [ ] Execute approved fixes against rules layer, design-tokens, renderer skills, and `design-generator` Phase 0 structural check
- [ ] Ship a permanent `visual-audit` skill so the entire audit becomes a single-command operation, hooked into weekly-audit

### Out of Scope

- Multi-tenant or multi-user expansion. Single-operator design is load-bearing for the workflow.
- Mobile-native app. Web-responsive only; mobile UI must work but no native iOS / Android.
- Real-time chat. Slack and SMS already cover that surface.
- Replacing Resend, Supabase, Vercel, or Next.js. Locked stack per `~/CLAUDE.md`.
- Building a public marketplace or agent-self-service onboarding. The agent portal is invite-only by magic link.
- Decorative use of GAT Red `#b31a35`. Direction B locks red for urgency states only.

## Context

- **Stack:** Next.js 14 App Router, Tailwind v3, shadcn v4, TypeScript, Supabase (Postgres + RLS + Realtime + Edge Functions), Resend (transactional + broadcast email), Vercel (hosting + CI/CD + Fluid Compute), pnpm (never npm or yarn).
- **Auth:** Supabase Auth with magic-link invites for agent portal access; middleware at `middleware.ts` gates non-public routes.
- **Activity ledger:** `activity_events` is the canonical write target as of Slice 1. All user-observable actions emit via `writeEvent()` from `src/lib/activity/writeEvent.ts`. Spine tables (`spine_inbox`, `commitments`, `signals`, `focus_queue`, `cycle_state`) are deprecated and slated for drop in Slice 2.
- **Dashboard architecture:** Bento grid via CSS Grid `grid-template-areas`, four card sizes, cap at 8-10 visible cards. No drag-and-drop dashboard layouts. See `~/.claude/rules/dashboard-architecture.md` for locked stack decisions (TanStack Query v5, shadcn/ui Charts, dnd-kit, cmdk, Supabase Realtime invalidation).
- **Today View:** Linear Focus model with 6 prioritized buckets, in fixed order: Overdue follow-ups, Closings today/tomorrow, Agents going cold, Scheduled meetings/calls, Proactive touchpoints, Pipeline items needing attention.
- **Direction B (Concierge) is the approved design direction.** Warm charcoal `#1A1714` background, champagne gold accents, Instrument Serif display numerals, Inter UI text, Crimson for urgency only.
- **Brand tokens (canonical):** System palette in `~/.claude/context/colors.md`; per-agent palettes in agent ruleset files. Typography in `~/.claude/context/typography.md`. Voice / co-brand / lender scoping in `~/.claude/rules/brand.md`.
- **GSD adopted as execution protocol inside `~/crm/`** as of 2026-04-19. `/lock` still owns paths outside `~/crm/`.
- **The Design Overhaul plan also touches files outside `~/crm/`,** specifically `~/.claude/skills/` and `~/.claude/rules/`. Phases that fix skill files commit to `~/.claude/` separately (different git scope). Phase PLAN.md files note this where applicable.

## Constraints

- **Tech stack:** Next.js 14 + Tailwind v3 + shadcn v4 + Supabase + Resend, locked per `~/CLAUDE.md`. Migrations to Next 15 / Tailwind v4 / shadcn upgrades are deferred.
- **Package manager:** pnpm only. Never npm or yarn.
- **Database access:** Supabase CLI exclusive (Rule 23). No `mcp__supabase__*`. No `~/Desktop/PASTE-INTO-SUPABASE-*.sql` paste files.
- **Verify before done:** `pnpm typecheck && pnpm build` must both pass on every change.
- **Em dashes banned everywhere:** Pre-commit hook blocks them. Use commas, periods, semicolons, or double hyphens.
- **No hard deletes:** Soft delete with `deleted_at` timestamp only (standing Rule 3).
- **Production-write gate:** Anything that leaves the local machine (git push, PR merge, prod deploy, email send) requires explicit Alex approval per standing Rule 5.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| `activity_events` as single canonical write target | Spine tables fragmented writes across five tables, making the timeline unreliable | ✓ Good |
| Bento CSS Grid (no DnD layouts) | Drag-and-drop dashboards are engineering tax; Claude-powered prioritization wins | ✓ Good |
| Direction B (Concierge) over Direction A | Warm charcoal + champagne gold + restrained crimson reads "title sales executive" not "tech startup" | ✓ Good |
| Crimson `#b31a35` for urgency only, never decoration | Color budget keeps the system disciplined and prevents loud-flyer drift | ⚠️ Revisit during Phase 027 fixes if multi-surface drift confirms violation |
| GSD as in-repo execution protocol | Phase-based atomic commits match how Alex thinks about slices | ✓ Good |
| Lock Supabase + Resend + Vercel as stack | Migration cost not justified by capability gain at this scale | -- Pending |
| Bootstrap PROJECT.md retroactively (2026-05-21) for v2.0 milestone | Greenfield project metadata never written; needed for /gsd-plan-phase orchestration on Design Overhaul | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? Move to Out of Scope with reason.
2. Requirements validated? Move to Validated with phase reference.
3. New requirements emerged? Add to Active.
4. Decisions to log? Add to Key Decisions.
5. "What This Is" still accurate? Update if drifted.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections.
2. Core Value check; still the right priority?
3. Audit Out of Scope; reasons still valid?
4. Update Context with current state.

---
*Last updated: 2026-05-21 after retroactive bootstrap for milestone v2.0 Design Overhaul*
