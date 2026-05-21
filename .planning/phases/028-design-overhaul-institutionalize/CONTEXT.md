# Phase 028 Context: Institutionalize Visual Audit

**Milestone:** v2.0 Design Overhaul
**Source plan section:** Phase 6 (Institutionalize) of `/Users/alex/Downloads/DESIGN-OVERHAUL-PLAN.md`

## Goal

Make the entire audit a one-command, recurring autonomous operation. Ship a permanent `visual-audit` skill, wire it into routing, hook it into weekly-audit, write the final report.

## Build

1. Create new skill: `~/.claude/skills/visual-audit/SKILL.md`
2. Skill triggers on: "audit my designs", "visual audit", "check the system", "screenshot audit", "are my designs broken"
3. Skill runs the entire Phase 023..027 flow as a single autonomous job and outputs the same `$AUDIT_DIR` structure
4. Add to `~/.claude/rules/skill-routing.md` so triggers route correctly
5. Hook into weekly-audit: either auto-runs every Friday, or surfaces "you haven't run a visual audit in N days" if no one runs it manually

## Final report

When all gates are complete, write `~/Desktop/DESIGN-OVERHAUL-{today}.md` summarizing:
- What was broken (linked to the 3 PATTERNS files)
- What was fixed (linked to FIX-VERIFICATION)
- New skill shipped (visual-audit)
- Recurring audit schedule established
- What Alex needs to review and approve

Open the file automatically per standing Rule 18.

## GATE 6: Skill Shipped

Output: `~/.claude/skills/visual-audit/SKILL.md` created, routing updated, weekly-audit hooked, final report on Desktop and opened.

## Requirements covered

- INST-01 (skill exists with triggers)
- INST-02 (skill runs the full flow autonomously, outputs `$AUDIT_DIR` structure)
- INST-03 (skill-routing.md updated)
- INST-04 (weekly-audit hooked: auto-run OR stale-warning)
- INST-05 (final report on Desktop, auto-opened)

## Notes for the planner

- This phase is almost entirely work in `~/.claude/`, not `~/crm/`. The CRM commit at the end of this phase is essentially just closing the milestone and updating STATE.md / MILESTONES.md.
- The "auto-run every Friday" path needs a hook or cron, not just a skill trigger. Consider whether ScheduleWakeup, a CronCreate routine, or a cron job is the right wire-in. Surface during Phase 028 planning.
- The stale-warning path is the simpler MVP: weekly-audit checks `$AUDIT_DIR` directory mtimes and warns if the most recent is older than 7 days. Less reliable than auto-run but lower implementation cost.
- After GATE 6 ships, run `/gsd-complete-milestone v2.0` to flip Active requirements to Validated in `.planning/PROJECT.md`.
