# Milestones: GAT-BOS

## v1.0 GAT-BOS Core (shipped)

**Period:** 2026-04 through 2026-05-21
**Status:** Shipped
**Phases:** 001 through 022 (with task-system-phase-0 work in flight on `task-system-phase-0` branch as of 2026-05-21)

**Goal:** Build the foundational CRM, activity ledger, agent portal, and Weekly Edge production pipeline.

**Delivered:**
- activity_events canonical ledger (replaces deprecated spine tables)
- contacts / opportunities / deals / interactions / tasks data model
- Today V2 live bind with the 6-bucket Linear Focus model
- Agent portal magic-link invite + read-only portal routes (Slice 7C)
- Weekly Edge assemble / send / review pipeline (Slice 8) with cron registration and live dry-run
- Altos pull + upsert worker (Slice B Cypher pull parked at PR #38, gates 4/5/6 burn-in deferred)
- Typography rebuild (Cal Sans + PT Sans + Great Day kit)
- Color palette rebuild (4-role system: Ground / Structure / Signal / Atmosphere)
- CRM visual elevation (5 phases, commit ae15619)
- Impeccable P0 sweep on task-system-phase-0 (PR #50)

**Phase history (in .planning/phases/):**
- 001-slice-1-activity-ledger
- 002-slice-2a-spine-drop
- 003-slice-2b-captures-consolidation
- 004-slice-2c-tasks-opportunities-interactions
- 005-slice-3-interactions-routes-cleanup
- 007-slice-3b-ticket-unification-oauth-cleanup-lib-carryforward
- 008-today-v2-live-bind
- 015-slice-7c-portal-routes-magic-link
- 020-slice-8-phase-4-weekly-edge-assemble-send-review
- 021-slice-8-phase-5-cron-registration-dry-run
- 022-slice-8-phase-5-5-altos-pull-upsert-fix

**Open loose ends from v1.0:**
- Slice B Cypher Pull Worker gates 4/5/6 burn-in (parked; resume from `loose_ends_2026_05_19_slice_b_gates.md`)
- task-system-phase-0 Gate 3 entry conditions (paused on MCP server blocker)

## v2.0 Design Overhaul (current)

**Started:** 2026-05-21
**Status:** Defining requirements, then planning
**Phases planned:** 023 through 028 (6 phases)

**Goal:** Audit every visual surface (CRM / website, email, flyer), identify the gap between rendered output and the locked Direction B Concierge spec, fix the highest-leverage violations, and ship a permanent `visual-audit` skill so the entire process becomes a one-command recurring operation.

**Source plan:** `/Users/alex/Downloads/DESIGN-OVERHAUL-PLAN.md`
**Approval source:** Claude Code on the web session `01DaGjzQrFpEZxjcsNXTKX4a`, approved by Alex 2026-05-21.

**Target outcomes:**
- Three PATTERNS.md reports (one per surface) capturing locked-spec violations
- One MASTER-FINDINGS.md and one MASTER-FIX-PLAN.md
- Approved fixes applied to rules layer, `design-tokens`, renderer skills, and `design-generator` Phase 0 structural check
- New `~/.claude/skills/visual-audit/` skill shipped and hooked into weekly-audit
- Recurring autonomous audit cadence established (weekly)

---

*Last updated: 2026-05-21 on bootstrap.*
