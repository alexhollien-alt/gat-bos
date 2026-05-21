# Phase 023 Context: CRM Surface Audit

**Milestone:** v2.0 Design Overhaul
**Source plan section:** Phase 1 (CRM / Website / GAT-BOS Audit) of `/Users/alex/Downloads/DESIGN-OVERHAUL-PLAN.md`
**Phase 0 (environment check) rolls into this phase as pre-work.**

## Goal

Capture the current visual state of every CRM and marketing surface via Playwright, write the locked Direction B Concierge spec to disk as the source of truth for the audit, run design-critique Mode A on every captured screenshot, and synthesize patterns into a single `PATTERNS.md` distinguishing system-level violations from component-level ones. No fixes applied here; GATE 1 halts before remediation.

## Pre-work: Environment check (one-time, 5 min)

Verify each item in order. If any fails, fix it before continuing. If any skill is missing, log to `$AUDIT_DIR/00-environment-gaps.md` and continue.

- Playwright CLI installed: `npx playwright --version`
- Chromium installed: `npx playwright install chromium`
- `~/.claude/skills/design-generator/SKILL.md` exists
- `~/.claude/skills/design-critique/SKILL.md` exists with Mode A and Mode B documented
- `~/.claude/skills/brand-audit/SKILL.md` exists
- `~/.claude/skills/design-tokens/SKILL.md` exists with current token values
- `~/.claude/rules/digital-aesthetic.md` exists (note: actual path may be `~/.claude/context/digital-aesthetic.md` per current rules)
- `~/.claude/rules/design-foundation.md` exists (note: actual path may be `~/.claude/context/design-foundation.md` per current rules)
- `~/.claude/rules/brand.md` exists and locks GAT Red `#b31a35`, GAT Blue `#003087`
- Create working directory: `mkdir -p /tmp/design-audit-$(date +%Y-%m-%d)`
- Set `AUDIT_DIR=/tmp/design-audit-$(date +%Y-%m-%d)` and use it everywhere

## Capture (fan out, parallel)

Boot the local dev server first: `cd ~/crm && pnpm dev`. Probe ports 3000 and 3001 per standing Rule 17.

For each route, parallel Playwright job:
- Viewports: `1440x900` (desktop) AND `390x844` (mobile)
- fullPage screenshots
- Save to `$AUDIT_DIR/crm/{route-name}-{viewport}.png`

Routes:
- `/dashboard`
- `/contacts` (or the live agent-list route)
- `/contacts/[id]` (first agent in the DB)
- `/events` (if it exists)
- `alexhollienco.com` (production URL, not local)

## Locked Direction B spec (write to disk)

Save to `$AUDIT_DIR/crm/direction-B-locked-spec.md`:

- Background: warm charcoal `#1A1714`
- Accents: champagne gold (find in `design-tokens` or use working value `#C9A961` and flag)
- Display numerals: Instrument Serif 700, tight letter spacing
- UI text: Inter 400, generous line height
- Metrics: Inter 600
- Crimson (`#b31a35`) used ONLY for urgency states, not decoration
- Calendar widget: top-right, integrated into layout, not floating
- Today's Focus prioritized over analytics widgets
- "Runway" interaction model: 6-10 tasks visible, system-ordered by effort, collapse on complete

If a reference image is on disk from the dashboard redesign chat history, use it. Otherwise reconstruct from the spec above.

## Critique (fan out, parallel)

For each PNG in `$AUDIT_DIR/crm/`, invoke `design-critique` Mode A against the locked spec. Save to `$AUDIT_DIR/crm/critique-{route-name}-{viewport}.md`.

Score per route:
1. Token compliance (locked colors actually used, or shadcn defaults bleeding through?)
2. Typography hierarchy (Instrument Serif on numerals? Inter weights correct?)
3. Spatial rhythm (consistent padding, gap, card spacing?)
4. Crimson usage ratio (decorative when it should be surgical?)
5. Calendar widget integration (native or bolted-on?)
6. Today's Focus hierarchy (dominant or buried?)

## Synthesize

Read all critique files. Write `$AUDIT_DIR/crm/PATTERNS.md` answering:
- Which Direction B locks are violated in 3+ routes? (system-level fix)
- Which violations are isolated to one route? (component-level fix)
- Is the token system actually wired into components, or are values hardcoded?
- Are the global CSS variables in `globals.css` correct?

## GATE 1: CRM Patterns Report

Output: `$AUDIT_DIR/crm/PATTERNS.md` written. Phase exits before any fixes start.

## Requirements covered

- AUDIT-CRM-01 (Playwright screenshots of /dashboard, /contacts, /contacts/[id], /events at desktop and mobile)
- AUDIT-CRM-02 (alexhollienco.com captured at both viewports)
- AUDIT-CRM-03 (locked Direction B spec written to disk)
- AUDIT-CRM-04 (design-critique Mode A run with 6-criterion rubric)
- AUDIT-CRM-05 (`PATTERNS.md` distinguishes system-level vs component-level violations)

## Notes for the planner

- Run captures in parallel; do not serialize.
- Fill-and-flag any missing route, missing reference image, or missing skill. Never stop the phase.
- Output is action, not commentary. No fixes in this phase.
