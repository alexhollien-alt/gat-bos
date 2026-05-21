# Phase 025 Context: Flyer Surface Audit

**Milestone:** v2.0 Design Overhaul
**Source plan section:** Phase 3 (Flyer / Print Audit) of `/Users/alex/Downloads/DESIGN-OVERHAUL-PLAN.md`

## Goal

The flyer surface is the hardest. The previously diagnosed problem was structural, not creative. Phase 0 structural integrity check runs BEFORE any creative critique. Anything that fails Phase 0 has unjudgeable creative direction; the critique only fires on flyers that pass. Synthesize patterns. No fixes; GATE 3 halts at synthesis.

## Identify the last 3 real flyers

Search `~/Desktop/` and `~/Documents/` for the most recent flyers (HTML or PDF) produced by `design-generator`. Candidates from memory:
- Deborah Rose 201 N McLane Rd brochure
- Julie Jarmiolowski Optima flyer (most recent)
- Joey + Amber Hollien flyer (if any)
- BNI Titans flyer

Use the 3 most recent. If fewer than 3 exist, use what you have and flag.

## Capture (fan out, parallel)

For each flyer HTML:
- Render at exact print dimensions (8.5x11 = `816x1056px` at 96dpi, OR 11x17 = `1056x1632px`)
- fullPage screenshot
- Also export to PDF with `printBackground: true`
- Save HTML, PNG, and PDF to `$AUDIT_DIR/flyer/{flyer-name}/`

## Phase 0 structural integrity check (per flyer)

This was the missing piece. For each rendered flyer:

1. **Bounding box collision detection.** Parse rendered HTML. For every text element, compute bounding box. Check for overlaps. Any overlap = structural fail.
2. **Overflow detection.** Does any element exceed page boundary?
3. **Photo dimension audit.** Use Pillow to inspect actual placed image dimensions vs. dimensions the layout expects. Mismatch = structural fail.
4. **Required slot presence.** Verify every spec'd slot (hero, stat bar, agent block, signature, GAT credit) is present.
5. **Title length guard.** If address line exceeds 24 characters, was the font size stepped down?

Save to `$AUDIT_DIR/flyer/{flyer-name}/phase-0-structural.md`. PASS or FAIL with structural issue list.

## Creative critique (only on flyers that PASS Phase 0)

Flyers that fail Phase 0 do not get a creative critique. Creative direction is unjudgeable until structure is sound.

Creative rubric:
1. Photo grid composition (sizes, ratios, focal point coverage)
2. Editorial hierarchy (does eye know where to go first, second, third?)
3. Stat bar treatment (integrated or floating?)
4. Agent positioning copy (present, sized correctly, not lost)
5. GAT credit treatment (footer credit only, not co-brand competing with agent)
6. Neighborhood / lifestyle section (present and integrated)
7. Color palette restraint (Sotheby's-level discipline, not loud)
8. Typography pairing (display + body working together, not fighting)

Save to `$AUDIT_DIR/flyer/{flyer-name}/critique.md`.

## Synthesize

`$AUDIT_DIR/flyer/PATTERNS.md`:
- Which flyers passed Phase 0? Which failed and why?
- Of those that passed, what creative patterns are violated across multiple flyers?
- Is the bug in `design-generator` itself, or in per-agent rulesets?
- Specifically: is the Phase 0 structural check actually wired into the skill, or was it specced but never built?

## GATE 3: Flyer Patterns Report

Output: `$AUDIT_DIR/flyer/PATTERNS.md`. Phase exits before any fixes.

## Requirements covered

- AUDIT-FLYER-01 (3 flyers identified, rendered, screenshotted, PDF'd)
- AUDIT-FLYER-02 (Phase 0 structural check with PASS/FAIL per flyer)
- AUDIT-FLYER-03 (creative critique only on Phase 0 passes)
- AUDIT-FLYER-04 (`PATTERNS.md` answers Phase 0 wiring question and bug locus)

## Notes for the planner

- The archetype assignment blocker (see `~/.claude/memory/project_archetype_assignment_pending.md`) is upstream of this phase. If archetypes aren't assigned for the 3 sampled agents, the flyer audit still runs against current state but the `PATTERNS.md` should note that archetype-aware analysis is incomplete.
- Pillow image audit is required, not optional. Standing Rule 14 mandates dimension audit before placement.
- The "specced but never built" Phase 0 wiring question is the single highest-leverage finding the audit can produce. If `design-generator/SKILL.md` references Phase 0 but the renderer doesn't actually run it, surface that as a top-line finding.
