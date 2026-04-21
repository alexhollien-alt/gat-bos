Run a full GAT-BOS status pass. This is read-only. Do not edit, create, or modify any files. No tool calls that mutate state.

READ IN THIS ORDER

1. CLAUDE.md (root) — project state, standing rules, routing layer
2. CHANGE-LOG.md — last 30 entries, most recent first
3. ROADMAP.md, BACKLOG.md, PHASES.md — whichever exist
4. friction-log.md — open issues
5. .claude/rules/*.md — all active standing rules
6. .claude/skills/ directory listing — skill inventory
7. .claude/commands/ directory listing — slash command inventory
8. package.json — dependency versions, scripts
9. .env.example — expected integrations
10. supabase/migrations/ directory listing — schema state
11. app/ or src/app/ directory structure — routes that exist
12. Any file named DI-*.md, project_di_trial.md, or skill-routing.md
13. Any file named ULTRAPLAN.md or phase-1.3*.md

If a file is missing, flag as [PLACEHOLDER: needs X] and keep going. Never stop.

THEN PRODUCE A REPORT IN THIS EXACT STRUCTURE

## WHERE I AM
One paragraph. Current phase, active trial or initiative, center of gravity this week.

## DEADLINE PRESSURE
List any date-bound items with days remaining. DI trial (4/28), seasonal campaign windows, quarterly pushes, agent events. Calculate from today's date. Flag anything inside 14 days as HOT.

## SHIPPED (last 14 days)
Bulleted list from CHANGE-LOG. Most recent first. Group by category: CRM, Email, Skills, Design, Integrations.

## CODE-COMPLETE BUT NOT DEPLOYED
Anything merged or finished locally that has not yet shipped to production. Include the blocker for each (ESLint warnings, missing env var, pending approval).

## IN FLIGHT
Work that's started but not finished. For each item list: what's done, what's left, what's blocking. Include current ticket or task if tracked.

## NEXT UP (priority order, top 7)
Rank by: user-visible impact, unblocks other work, time-sensitive deadlines, dependency ordering. For each item note which phase it belongs to and roughly one session of work or more.

## SYSTEM HEALTH

### Supabase
- Project ref confirmed: rndnxhvibbqqjrzapdxs
- Tables present vs tables expected (report missing)
- RLS enabled on all tables (yes/no + list any without)
- Contact count + A/B/C/P tier distribution
- Any migrations in supabase/migrations/ that haven't been applied to remote

### Integrations
- Gmail OAuth: configured / in progress / not started
- Resend: domain verification status, sender address, last successful send if tracked
- Google Calendar: connected / not connected
- Claude API: in use, any known burn concerns
- Vercel: last deploy status if detectable

### Skills System
- Total SKILL.md files present
- CLAUDE.md routing layer line count vs target (under 100 lines)
- Any skills flagged as deprecated or stale in memory
- Chain mode status if DI trial still active

### Deployment Readiness
- ESLint warnings count (especially exhaustive-deps)
- Any broken or failing builds mentioned in CHANGE-LOG
- Uncommitted changes note if detectable

## DEFERRED / PARKED
What's explicitly on hold and why. Note trigger for un-pausing each.

## FRICTION / OPEN DECISIONS
Anything needing my call before it can move. Phrase each as a yes/no or A/B question when possible.

## GAPS I MIGHT NOT BE SEEING
Features the ROADMAP expects that aren't reflected anywhere in code, skills, or recent CHANGE-LOG entries. Be specific: name the phase, name the feature, name what's missing.

## ONE-LINE VERDICT
Single sentence. Am I on track, behind, or ahead of the master plan as written.

RULES

- No em dashes anywhere in the output.
- If a claim is inferred rather than read from a file, mark it [inferred].
- Keep each section scannable. Bullets over paragraphs where the content is list-shaped.
- Do not recommend solutions inside this report. This is a status pass, not a planning session. Save recommendations for a follow-up prompt.
- If anything looks broken or suspicious, flag it with [CHECK] and keep going.
- Target length: fits in one screen-and-a-half on a laptop. Trim ruthlessly.
