# Phase 024 Context: Email Surface Audit

**Milestone:** v2.0 Design Overhaul
**Source plan section:** Phase 2 (Email Audit) of `/Users/alex/Downloads/DESIGN-OVERHAUL-PLAN.md`

## Goal

Capture every production email template at desktop and mobile widths, in both light and Gmail dark-mode simulation. Audit the `re-email-design` skill for stale platform references before running creative critique. Synthesize cross-template patterns into `PATTERNS.md`. No fixes; GATE 2 halts at synthesis.

## Capture (fan out, parallel)

Identify the latest production email templates. Likely locations:
- Most recent Weekly Edge HTML in `~/crm/src/lib/templates/` or wherever templates live now
- Closing Brief master template
- Monthly Toolkit master template
- Partner Spotlight master template

For each HTML file, parallel Playwright job:
- Load as `file://`
- Render at desktop email width (`640px`)
- Render at mobile (`375px`)
- Render with light AND dark client simulation (Gmail dark mode kills a lot of designs)
- fullPage screenshots
- Save to `$AUDIT_DIR/email/{template-name}-{viewport}-{mode}.png`

If any template is missing, fill-and-flag and keep going.

## Skill staleness check

Read `~/.claude/skills/re-email-design/SKILL.md`. Grep for:
- "Mailerlite" (should be zero matches)
- "Zapier" / "Make" / "Twilio" (should be zero)
- Em dashes (should be zero per standing Rule 2)
- Deprecated color hex values (anything that isn't `#b31a35` or `#003087` or documented in design-tokens)

Save findings to `$AUDIT_DIR/email/skill-staleness.md`.

## Critique (fan out, parallel)

design-critique Mode A on each email screenshot, email-specific rubric:
1. Masthead hierarchy (Syne or Playfair display sized correctly? Red eyebrow at 11px tracking 0.12em?)
2. Section depth (dark/light alternation present? Texture gradient at 3-4% on dark sections?)
3. Red usage count (5-7 instances max per email; count in screenshot)
4. Blue usage count (rarer than red; count)
5. Inline style coverage (Outlook will break if critical styles aren't inline)
6. Mobile stack (does listing grid collapse to single column under 640px?)
7. Dark mode survivability (holds up in Gmail dark mode?)

Each critique to `$AUDIT_DIR/email/critique-{template}-{viewport}-{mode}.md`.

## Synthesize

`$AUDIT_DIR/email/PATTERNS.md`:
- Which design rules are violated across multiple templates?
- Is `re-email-design` itself out of date (stale platform refs, deprecated colors)?
- Where are the inline-style gaps that would break Outlook?

## GATE 2: Email Patterns Report

Output: `$AUDIT_DIR/email/PATTERNS.md`. Phase exits before any fixes.

## Requirements covered

- AUDIT-EMAIL-01 (Playwright captures 4 templates at desktop and mobile widths, light and dark mode)
- AUDIT-EMAIL-02 (skill staleness scan with findings file)
- AUDIT-EMAIL-03 (design-critique Mode A with 7-criterion email rubric)
- AUDIT-EMAIL-04 (`PATTERNS.md` cross-template synthesis)

## Notes for the planner

- Templates may live in `~/crm/src/lib/templates/` (CRM repo) or `~/.claude/skills/re-email-design/` (skills repo). Search both.
- Gmail dark mode is the hardest case and the most often broken; do not skip it.
- The skill staleness file may need to feed Phase 027 (fix execution) if any deprecated platform references are found.
