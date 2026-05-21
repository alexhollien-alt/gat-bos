# Phase 026 Context: Cross-Surface Synthesis

**Milestone:** v2.0 Design Overhaul
**Source plan section:** Phase 4 (Cross-Surface Synthesis) of `/Users/alex/Downloads/DESIGN-OVERHAUL-PLAN.md`

## Goal

Synthesize the three PATTERNS.md reports from Phases 023, 024, 025 into a single master findings document, then produce a prioritized fix plan. GATE 4 halts: no fixes are applied until Alex reviews both documents and explicitly approves the fix branch.

## Inputs

Read all three:
- `$AUDIT_DIR/crm/PATTERNS.md`
- `$AUDIT_DIR/email/PATTERNS.md`
- `$AUDIT_DIR/flyer/PATTERNS.md`

## MASTER-FINDINGS.md (write to `$AUDIT_DIR/MASTER-FINDINGS.md`)

Answer:
1. **What's broken in COMMON across all three surfaces?** (system-level issue, fix at the rules / tokens layer)
2. **What's broken in ONLY ONE surface?** (skill-specific issue, fix at the skill file)
3. **What's actually a workflow issue vs. a design issue?** (e.g., "Playwright audit never ran" is workflow; "red used decoratively" is design)
4. **Which skills need rewrites and what specifically needs to change in each one?**
5. **Top-5 highest-leverage fixes** ranked by impact-per-hour.

## MASTER-FIX-PLAN.md (write to `$AUDIT_DIR/MASTER-FIX-PLAN.md`)

For each top-5 fix:
- File to edit (exact path; absolute, not relative)
- Change to make (specific, line-level if possible)
- How to verify the fix worked (the Playwright screenshot + critique that proves it)
- Priority (P0 / P1 / P2)

## GATE 4: Master Reports Complete

Phase exits here. Do NOT apply any fixes. Alex reviews `MASTER-FINDINGS.md` and `MASTER-FIX-PLAN.md`, then approves the fix branch before Phase 027 starts.

This is the milestone's primary human checkpoint. Standing Rule 5 production-write gate applies.

## Requirements covered

- SYNTH-01 (`MASTER-FINDINGS.md` answers the 5 framing questions)
- SYNTH-02 (`MASTER-FIX-PLAN.md` ranks top-5 with file paths, changes, verification, priority)
- SYNTH-03 (GATE 4 halt; explicit Alex approval before Phase 027)

## Notes for the planner

- The synthesis is the deliverable. No code in this phase. No file edits outside `$AUDIT_DIR/`.
- If `PATTERNS.md` inputs disagree, surface the disagreement in MASTER-FINDINGS rather than picking one silently (standing Rule 4 corroboration mindset).
- Rank by impact-per-hour, not by raw severity. A P0 that takes 40 hours sits below a P1 that takes 2.
