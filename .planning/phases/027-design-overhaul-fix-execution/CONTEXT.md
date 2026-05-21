# Phase 027 Context: Autonomous Fix Execution

**Milestone:** v2.0 Design Overhaul
**Source plan section:** Phase 5 (Autonomous Fix Execution) of `/Users/alex/Downloads/DESIGN-OVERHAUL-PLAN.md`
**Entry condition:** Alex has explicitly approved `MASTER-FIX-PLAN.md` from Phase 026.

## Goal

Apply the approved fixes in dependency order so that rules cascade to skills, skills cascade to renders, and the highest-leverage wiring lands. Verify each fix with a before/after screenshot pair.

## Fix order (do not deviate)

1. **Rules layer first.** Any `~/.claude/rules/*.md` updates. These cascade to every skill.
2. **`design-tokens` SKILL.md.** Lock current token values. Remove deprecated entries.
3. **Renderer skills.** In this exact order: `design-generator`, `re-email-design`, `re-landing-page`, `re-listing-presentation`.
4. **Wire Phase 0 structural integrity check into `design-generator`.** Single highest-leverage fix. Specced and never built; build it now.
5. **Wire Playwright screenshot + auto-critique loop into the design workflow.** Every render generates a screenshot, runs the critique skill, fails the draft if any structural issue is found.
6. **Re-render the 3 audit flyers + last Weekly Edge + dashboard.** Compare to Phase 023..025 baselines.

Each fix saves a before/after screenshot pair to `$AUDIT_DIR/fixes/{fix-id}-{before|after}.png`.

## Cross-repo commits

Fixes that touch:
- `~/crm/*` commit to the phase branch in the `~/crm` repo
- `~/.claude/skills/*` and `~/.claude/rules/*` commit to the `~/.claude` repo (separate git scope)

The Phase 027 PLAN.md must split commits by repo. Do not try to land both in a single `git commit`.

## GATE 5: Fixes Verified

Output: `$AUDIT_DIR/FIX-VERIFICATION.md` with before/after screenshot pairs and pass/fail per fix.

## Requirements covered

- FIX-01 (rules layer first)
- FIX-02 (design-tokens lock)
- FIX-03 (renderer skills in order)
- FIX-04 (Phase 0 check wired into design-generator)
- FIX-05 (Playwright screenshot + auto-critique loop wired)
- FIX-06 (re-render audit baselines and diff)
- FIX-07 (`FIX-VERIFICATION.md`)

## Notes for the planner

- Standing Rule 5 still applies. Production writes (push, PR open, broadcast send) require explicit Alex go-ahead.
- The Playwright + auto-critique loop wiring may need to live in a hook (`~/.claude/hooks/`) rather than in a skill file. Surface the wiring location during Phase 027 planning.
- If FIX-04 (Phase 0 wiring) turns out to be a multi-day build (parser + bounding box library selection + integration tests), split it into a separate phase rather than letting it dominate this one. Surface during planning.
- "Em dashes banned" applies to every file written here (standing Rule 2). The pre-commit hook will block otherwise.
- Re-rendered baselines must be saved alongside the originals; do not overwrite Phase 023..025 captures.
