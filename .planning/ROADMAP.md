# Roadmap: GAT-BOS v2.0 Design Overhaul

**Milestone:** v2.0 Design Overhaul
**Created:** 2026-05-21
**Source plan:** `/Users/alex/Downloads/DESIGN-OVERHAUL-PLAN.md`
**Phases:** 023 through 028 (6 phases, continuing from highest existing phase 022)

## Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 023 | CRM Surface Audit | Capture and critique every CRM / website surface against the locked Direction B Concierge spec | AUDIT-CRM-01..05 | 5 |
| 024 | Email Surface Audit | Capture and critique every production email template against locked spec, in light and Gmail dark mode | AUDIT-EMAIL-01..04 | 4 |
| 025 | Flyer Surface Audit | Run Phase 0 structural integrity before creative critique on the last 3 real flyers | AUDIT-FLYER-01..04 | 4 |
| 026 | Cross-Surface Synthesis | Synthesize three PATTERNS reports into MASTER-FINDINGS and MASTER-FIX-PLAN; halt for Alex approval | SYNTH-01..03 | 3 |
| 027 | Autonomous Fix Execution | Apply approved fixes in order (rules / design-tokens / renderer skills / Phase 0 wiring / screenshot loop / re-render diff) | FIX-01..07 | 5 |
| 028 | Institutionalize Visual Audit | Ship `visual-audit` skill, route triggers, hook weekly-audit, final report | INST-01..05 | 4 |

## Phase Details

### Phase 023: CRM Surface Audit

**Goal:** Capture the current visual state of every CRM and marketing surface, then run Mode A design critique against the locked Direction B spec to identify where shadcn defaults, off-palette accents, or hierarchy violations are bleeding through.

**Requirements:** AUDIT-CRM-01, AUDIT-CRM-02, AUDIT-CRM-03, AUDIT-CRM-04, AUDIT-CRM-05

**Success criteria:**
1. `$AUDIT_DIR/crm/*.png` populated with desktop and mobile screenshots of /dashboard, /contacts, /contacts/[id], /events, and `alexhollienco.com`
2. `$AUDIT_DIR/crm/direction-B-locked-spec.md` written and explicit about background color, accent palette, type roles, crimson usage rule, calendar widget placement, Today's Focus hierarchy
3. `$AUDIT_DIR/crm/critique-{route}-{viewport}.md` produced per captured screenshot using design-critique Mode A
4. `$AUDIT_DIR/crm/PATTERNS.md` distinguishes system-level violations (3+ routes) from component-level violations
5. No fixes attempted in this phase (GATE 1 halts before remediation)

**Notes:**
- Boot dev server first via `pnpm dev` in `~/crm/`. Probe ports 3000 and 3001 per standing Rule 17.
- Run the route captures in parallel per the source plan's "fan out" directive.

**Plans:** 5 plans

Plans:
- [ ] 023-01-PLAN.md, Wave 0 environment check + Playwright auth storageState capture (blocks all downstream waves)
- [ ] 023-02-PLAN.md, Wave 1 write Direction B locked spec to disk (parallel with 03)
- [ ] 023-03-PLAN.md, Wave 1 fan-out Playwright captures (5 routes x 2 viewports + /events fill-and-flag)
- [ ] 023-04-PLAN.md, Wave 2 design-critique Mode A per captured PNG (8 critique markdowns)
- [ ] 023-05-PLAN.md, Wave 3 synthesize PATTERNS.md (system vs component partition; GATE 1 halt)

### Phase 024: Email Surface Audit

**Goal:** Capture every production email template at desktop and mobile widths, in both light and Gmail dark-mode simulation, and audit `re-email-design` for stale platform references before running creative critique.

**Requirements:** AUDIT-EMAIL-01, AUDIT-EMAIL-02, AUDIT-EMAIL-03, AUDIT-EMAIL-04

**Success criteria:**
1. `$AUDIT_DIR/email/*.png` populated for Weekly Edge, Closing Brief, Monthly Toolkit, Partner Spotlight at 640px and 375px widths, light and dark simulation
2. `$AUDIT_DIR/email/skill-staleness.md` written with zero-or-more findings (Mailerlite, Zapier, Make, Twilio, em dashes, deprecated hex)
3. design-critique Mode A reports written per email screenshot with the email-specific rubric (red/blue count, inline-style coverage, mobile stack, dark-mode survivability)
4. `$AUDIT_DIR/email/PATTERNS.md` synthesizes cross-template violations and skill staleness

**Notes:**
- Templates may live in `~/crm/src/lib/templates/`, `~/.claude/skills/re-email-design/`, or both. Fill-and-flag if any template is missing.
- Gmail dark-mode simulation is the hardest case; do not skip it.

### Phase 025: Flyer Surface Audit

**Goal:** Identify the last 3 real flyers, run a Phase 0 structural integrity check before any creative critique, and determine whether the structural bug lives in `design-generator` or in per-agent rulesets.

**Requirements:** AUDIT-FLYER-01, AUDIT-FLYER-02, AUDIT-FLYER-03, AUDIT-FLYER-04

**Success criteria:**
1. 3 flyers identified, rendered at print dimensions, screenshotted, and exported to PDF in `$AUDIT_DIR/flyer/{flyer-name}/`
2. Phase 0 structural check (bounding box collision, overflow, photo dimension audit via Pillow, required slot presence, title-length guard) produces PASS or FAIL per flyer in `phase-0-structural.md`
3. Creative critique runs ONLY on flyers that pass Phase 0 (failed flyers have unjudgeable creative direction)
4. `$AUDIT_DIR/flyer/PATTERNS.md` answers: is Phase 0 specced but never built? Is the bug in `design-generator` or in rulesets?

**Notes:**
- Candidate flyers from memory: Deborah Rose 201 N McLane Rd brochure, Julie Jarmiolowski Optima, Joey + Amber Hollien, BNI Titans. Use whichever 3 are most recent.
- Print dimensions: 8.5x11 = 816x1056px at 96dpi; 11x17 = 1056x1632px.

### Phase 026: Cross-Surface Synthesis

**Goal:** Synthesize the three PATTERNS reports into a single master findings document and a prioritized fix plan, then halt at Gate 4 for Alex approval before any fixes are applied.

**Requirements:** SYNTH-01, SYNTH-02, SYNTH-03

**Success criteria:**
1. `$AUDIT_DIR/MASTER-FINDINGS.md` answers: what breaks in common across all three surfaces (system-level fix at rules / tokens), what breaks in one surface (skill-specific fix), what is a workflow vs design issue, which skills need rewrites
2. `$AUDIT_DIR/MASTER-FIX-PLAN.md` ranks the top-5 highest-leverage fixes with file paths, line-level changes, verification method, P0/P1/P2 priority
3. GATE 4 halt: phase exits before any fix is applied; Alex reviews both documents and explicitly approves the fix branch before Phase 027 starts

**Notes:**
- This is the milestone's primary human checkpoint. Standing Rule 5 production-write gate applies here.

### Phase 027: Autonomous Fix Execution

**Goal:** Apply the approved fixes in dependency order (rules cascade to skills, skills cascade to renders), wire Phase 0 structural integrity into `design-generator`, wire the Playwright + auto-critique loop into the design workflow, and re-render the audit baselines to verify each fix.

**Requirements:** FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06, FIX-07

**Success criteria:**
1. Fix order honored: rules layer → design-tokens → renderer skills (design-generator first) → Phase 0 wiring → screenshot/critique loop wiring → re-render → verification report
2. Phase 0 structural integrity check actually exists in `design-generator` after this phase (was specced, not built; this is the single highest-leverage fix)
3. Playwright + auto-critique loop wired so every render generates a screenshot, runs critique, fails draft on structural issue
4. Before/after screenshot pairs saved to `$AUDIT_DIR/fixes/{fix-id}-{before|after}.png`
5. `$AUDIT_DIR/FIX-VERIFICATION.md` records pass/fail per fix

**Notes:**
- Fixes that touch `~/.claude/skills/*` and `~/.claude/rules/*` commit to the `~/.claude` repo (different git scope), not to the `~/crm` phase branch. Phase PLAN.md must split commits by repo.
- Standing Rule 5 still applies: production writes (push, PR open, broadcast) require explicit Alex go-ahead.

### Phase 028: Institutionalize Visual Audit

**Goal:** Make the entire audit a single-command, recurring autonomous operation by shipping a permanent `visual-audit` skill, wiring it into routing, and hooking it into weekly-audit.

**Requirements:** INST-01, INST-02, INST-03, INST-04, INST-05

**Success criteria:**
1. `~/.claude/skills/visual-audit/SKILL.md` exists with explicit triggers ("audit my designs", "visual audit", "check the system", "screenshot audit", "are my designs broken")
2. Skill runs the entire Phase 023..027 flow autonomously and outputs the same `$AUDIT_DIR/` structure
3. `~/.claude/rules/skill-routing.md` updated so triggers route correctly to `visual-audit`
4. weekly-audit either auto-runs `visual-audit` every Friday OR surfaces a "you haven't run a visual audit in N days" warning when no one runs it manually. `~/Desktop/DESIGN-OVERHAUL-{today}.md` final report auto-opened per standing Rule 18.

**Notes:**
- This phase is mostly skill-creation work in `~/.claude/`, not `~/crm/`. Phase PLAN.md should be explicit about which writes happen in which repo.

## Coverage Validation

- v2.0 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓
- Phases: 6 total, each with 3..7 requirements and 3..5 success criteria

## Numbering Decision

Phases continue from the previous milestone (highest existing phase folder is `022-slice-8-phase-5-5-altos-pull-upsert-fix`). This roadmap does NOT use `--reset-phase-numbers`. v2.0 starts at 023.

---
*Roadmap created: 2026-05-21 on bootstrap for milestone v2.0 Design Overhaul*
