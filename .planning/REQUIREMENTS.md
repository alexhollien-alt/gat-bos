# Requirements: GAT-BOS

**Defined:** 2026-05-21
**Core Value:** Keep agent relationships warm and transactions on track. The Today View must surface the right next action for the right agent at the right time.

## v2.0 Requirements (Design Overhaul)

Requirements for the Design Overhaul milestone. Each maps to roadmap phase 023 through 028.

### CRM Surface Audit (AUDIT-CRM)

- [ ] **AUDIT-CRM-01**: Playwright captures fullPage screenshots of /dashboard, /contacts, /contacts/[id], /events at desktop (1440x900) and mobile (390x844) viewports
- [ ] **AUDIT-CRM-02**: Marketing landing page at `alexhollienco.com` captured at both viewports against production URL
- [ ] **AUDIT-CRM-03**: Locked Direction B Concierge spec written to `$AUDIT_DIR/crm/direction-B-locked-spec.md` as source of truth for the audit
- [ ] **AUDIT-CRM-04**: design-critique Mode A run against every captured CRM screenshot, scoring token compliance, typography hierarchy, spatial rhythm, crimson usage ratio, calendar widget integration, Today's Focus hierarchy
- [ ] **AUDIT-CRM-05**: CRM patterns synthesized into `$AUDIT_DIR/crm/PATTERNS.md` identifying system-level violations (3+ routes) vs component-level violations (single route)

### Email Surface Audit (AUDIT-EMAIL)

- [ ] **AUDIT-EMAIL-01**: Playwright captures every production email template (Weekly Edge, Closing Brief, Monthly Toolkit, Partner Spotlight) at desktop (640px) and mobile (375px), in both light and Gmail dark-mode simulation
- [ ] **AUDIT-EMAIL-02**: `re-email-design` skill scanned for stale platform references (Mailerlite, Zapier, Make, Twilio), em dashes, deprecated colors; findings written to `$AUDIT_DIR/email/skill-staleness.md`
- [ ] **AUDIT-EMAIL-03**: design-critique Mode A run against every email screenshot with email-specific rubric (masthead hierarchy, section depth, red/blue usage counts, inline-style coverage, mobile stack, dark-mode survivability)
- [ ] **AUDIT-EMAIL-04**: Email patterns synthesized into `$AUDIT_DIR/email/PATTERNS.md` capturing cross-template violations and skill staleness

### Flyer Surface Audit (AUDIT-FLYER)

- [ ] **AUDIT-FLYER-01**: Last 3 real flyers identified from `~/Desktop/` and `~/Documents/` (Deborah Rose, Julie Jarmiolowski, Joey + Amber Hollien, BNI Titans candidates); captured via Playwright at 8.5x11 and 11x17 print dimensions, also exported to PDF with `printBackground: true`
- [ ] **AUDIT-FLYER-02**: Phase 0 structural integrity check run on every flyer: bounding-box collision detection, overflow detection, photo dimension audit via Pillow, required slot presence, title-length guard. PASS or FAIL per flyer recorded.
- [ ] **AUDIT-FLYER-03**: design-critique Mode A run ONLY on flyers that pass Phase 0 (creative direction is unjudgeable until structure is sound)
- [ ] **AUDIT-FLYER-04**: Flyer patterns synthesized into `$AUDIT_DIR/flyer/PATTERNS.md` identifying whether the structural bug lives in `design-generator` itself or per-agent rulesets, and whether the Phase 0 check was specced but never built

### Cross-Surface Synthesis (SYNTH)

- [ ] **SYNTH-01**: All three PATTERNS.md files read and synthesized into `$AUDIT_DIR/MASTER-FINDINGS.md` answering: common breaks across surfaces, single-surface breaks, workflow vs design issues, which skills need rewrites
- [ ] **SYNTH-02**: Top-5 highest-leverage fixes ranked by impact-per-hour and written to `$AUDIT_DIR/MASTER-FIX-PLAN.md` with file paths, change descriptions, verification method, P0/P1/P2 priority
- [ ] **SYNTH-03**: Alex review gate held; no fixes applied until explicit approval (standing Rule 5)

### Fix Execution (FIX)

- [ ] **FIX-01**: Rules layer fixes (`~/.claude/rules/*.md`) applied first since they cascade to every skill
- [ ] **FIX-02**: `design-tokens` SKILL.md updated to lock current token values and remove deprecated entries
- [ ] **FIX-03**: Renderer skills fixed in order: `design-generator`, `re-email-design`, `re-landing-page`, `re-listing-presentation`
- [ ] **FIX-04**: Phase 0 structural integrity check wired into `design-generator` (the single highest-leverage fix; specced but never built)
- [ ] **FIX-05**: Playwright screenshot + auto-critique loop wired into the design workflow so every render generates a screenshot, runs the critique skill, and fails the draft if any structural issue is found
- [ ] **FIX-06**: 3 audit flyers + latest Weekly Edge + dashboard re-rendered and diff'd against Phase 1-3 baselines; before/after screenshot pairs saved
- [ ] **FIX-07**: `$AUDIT_DIR/FIX-VERIFICATION.md` written with pass/fail per fix

### Institutionalize (INST)

- [ ] **INST-01**: New skill at `~/.claude/skills/visual-audit/SKILL.md` created. Triggers: "audit my designs", "visual audit", "check the system", "screenshot audit", "are my designs broken".
- [ ] **INST-02**: Skill runs the entire audit flow above as a single autonomous job and outputs the same `$AUDIT_DIR` structure
- [ ] **INST-03**: Added to `~/.claude/rules/skill-routing.md` so triggers route correctly
- [ ] **INST-04**: Weekly-audit hooked: either auto-runs every Friday or surfaces "you haven't run a visual audit in N days" when no one runs it manually
- [ ] **INST-05**: Final report at `~/Desktop/DESIGN-OVERHAUL-{today}.md` summarizes what broke, what was fixed, new skill, recurring schedule, and what Alex needs to review. Auto-opened per standing Rule 18.

## v3.0+ Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Auto-Triage Followup

- **TRIAGE-01**: Cross-skill auto-triage system extending the `feat/audit-auto-triage` PR #48 draft into a permanent loop

### Design Token Migration

- **TOKEN-01**: Hard remove every hardcoded hex, font-family, and spacing value from skill files (post visual-audit rollout)
- **TOKEN-02**: Single canonical `design-tokens/` package that all skills import from at generation time

### Recurring Audit Cadence Beyond Visual

- **CADENCE-01**: Weekly autonomous audit covers visual surfaces AND data integrity (timeline gaps, stale interactions, dead followups)

## Out of Scope

Explicitly excluded from v2.0 Design Overhaul. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Rebuilding the Direction B locked spec | Spec is already locked; the audit measures against it, doesn't redefine it |
| Auditing every per-agent ruleset | Audit operates against system tokens; per-agent overrides are tested only via the 3 sampled flyers |
| Migrating to Tailwind v4 or shadcn v5 | Stack locked per `~/CLAUDE.md`; design fixes operate within v3 / v4 |
| Refactoring `design-generator` skill structure | Phase 0 check gets wired in; structural skill refactor is a separate effort |
| Building a Canva MCP audit | Canva pipeline is a separate surface; Design Overhaul audits Claude-generated output only |
| Auditing slide-deck-generator | Single-listing presentation surface only; non-listing slide decks deferred to v3.0+ |
| Auditing print pieces beyond flyers (door hangers, postcards, EDDM, brochures) | Sampled 3 flyers cover the structural class; specialty print surfaces deferred to follow-on |
| Re-running the audit during fix execution | One audit, one fix pass per milestone; recurring audits ship as INST output |

## Traceability

Which phases cover which requirements. Phases numbered 023 through 028 to continue from existing phase 022.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIT-CRM-01 | Phase 023 | Pending |
| AUDIT-CRM-02 | Phase 023 | Pending |
| AUDIT-CRM-03 | Phase 023 | Pending |
| AUDIT-CRM-04 | Phase 023 | Pending |
| AUDIT-CRM-05 | Phase 023 | Pending |
| AUDIT-EMAIL-01 | Phase 024 | Pending |
| AUDIT-EMAIL-02 | Phase 024 | Pending |
| AUDIT-EMAIL-03 | Phase 024 | Pending |
| AUDIT-EMAIL-04 | Phase 024 | Pending |
| AUDIT-FLYER-01 | Phase 025 | Pending |
| AUDIT-FLYER-02 | Phase 025 | Pending |
| AUDIT-FLYER-03 | Phase 025 | Pending |
| AUDIT-FLYER-04 | Phase 025 | Pending |
| SYNTH-01 | Phase 026 | Pending |
| SYNTH-02 | Phase 026 | Pending |
| SYNTH-03 | Phase 026 | Pending |
| FIX-01 | Phase 027 | Pending |
| FIX-02 | Phase 027 | Pending |
| FIX-03 | Phase 027 | Pending |
| FIX-04 | Phase 027 | Pending |
| FIX-05 | Phase 027 | Pending |
| FIX-06 | Phase 027 | Pending |
| FIX-07 | Phase 027 | Pending |
| INST-01 | Phase 028 | Pending |
| INST-02 | Phase 028 | Pending |
| INST-03 | Phase 028 | Pending |
| INST-04 | Phase 028 | Pending |
| INST-05 | Phase 028 | Pending |

**Coverage:**
- v2.0 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-21*
*Last updated: 2026-05-21 on bootstrap for milestone v2.0 Design Overhaul*
