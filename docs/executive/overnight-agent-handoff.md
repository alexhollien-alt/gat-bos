# Overnight Agent Handoff

Morning-readable summary of the overnight executive-strategy session against `~/crm/`. Read this first; pointers into the other 7 docs at the bottom.

## What ran

Read-only analysis pass covering:

1. Codebase architecture (`~/crm/src/`, AI layer, components, deps, hotspots, planning docs)
2. 15-slice roadmap (`composed-herding-backus.md`, 7A.5 boundary, business pack, sequencing rationale)
3. Operational patterns (project memory, STATUS, paste-files, skill telemetry)
4. CRM business domain (entities, instrumented vs manual, dashboard widgets, fragility flags)

Output: 8 markdown files in `~/crm/docs/executive/`. Zero schema changes, zero code changes, zero migration touches, zero commits, zero pushes.

## Top 10 highest-leverage moves

1. **Migration registry hygiene gate** -- post-7A.5 enforcement hook on `supabase migration list --linked`. Low complexity, high impact, before-v1.0.
2. **Resend wiring + email send live** -- the largest dark surface in the system. Wiring waits on Alex's Resend account setup. Before-v1.0.
3. **Slice 7B ship** -- multi-tenant contacts + 5 agent seed; locked plan ready, paused on 7A.5. Critical chain.
4. **Inbound email -> contact auto-link** -- ~30 lines in the draft generator path. Closes a per-draft retyping loop and feeds the health-score pipeline. Before-v1.0.
5. **Cold-leads materialized view + Today widget** -- Tier-1 dashboard surface currently a roadmap gap. Before-v1.0.
6. **task-list.tsx refactor** -- 979 LOC -> custom hooks. Sets the pattern for the other three hotspots. v1.0.
7. **Skill telemetry monthly digest** -- the hook fires; nothing reads it. 169 skills installed, 21 unique invoked. Before-v1.0.
8. **Slice 7C ship** -- agent portal + magic-link auth. Switches operating model from "Alex is the bottleneck" to "Alex reviews and approves." v1.0.
9. **Template versioning + draft re-render** -- ends the "send a draft and discover the template changed" failure mode. After-v1.0.
10. **Slice 8A content engine** -- long-form to short-form derivative pipeline; one Weekly Edge becomes 5-10 social posts. After-v1.0.

Full detail in `highest-leverage-opportunities.md`.

## Top 10 things NOT to build yet

These are speculative, premature, or post-v1.0 deferrals. Each is named with the reason.

1. **Voice memo transcription pipeline** -- captures rules parser is text-only today; AI parser is opt-in. Voice transcription is a separate build with its own risk surface. v2.0.
2. **Per-account health scoring (vs global)** -- 7C ships account_id; per-account health is a polish item. v2.0.
3. **Email-to-deal attribution view** -- requires campaigns and deals to coexist with stable engagement data. v2.0.
4. **Contact enrichment pipeline on new contacts** -- Phase 4 territory. Adds a class of external API dependencies. v2.0.
5. **External providers outside the locked stack** -- per the analysis-session no-touch list. Out of scope.
6. **Reactivation drip automation** -- the cold-leads MV is the input (v1.0); the drip itself is v2.0.
7. **Sponsor association schema** -- builds on 8B referrals, which is Q4. v2.0.
8. **Calendar attendee staleness flag** -- silent failure mode; not blocking v1.0. v2.0.
9. **Captures fuzzy-match fallback** -- silent failure mode. v2.0.
10. **intake/page.tsx, contacts/[id]/page.tsx, analytics/page.tsx refactors** -- each gets cheaper after task-list.tsx sets the pattern. Only task-list.tsx makes the v1.0 cut.

Full detail in `v1-to-v2-strategy.md`.

## Safest next actions after 7A.5 lands

In order. The first three are parallel; do not block on each other.

1. **Land the migration registry hygiene gate** in the same week 7A.5 closes. Locks the floor.
2. **Resend account setup** (Alex). Once `RESEND_WEBHOOK_SECRET` and the API key are in `.env`, the campaign-runner cron, templates abstraction, and message_events ingestion all activate. No code change needed.
3. **Pre-flight Slice 7B** against the now-clean local DB. Pre-flight is 80% complete; tasks 0-9 defined; estimated 6-8 hours of execution.

After those, sequence Slice 7B -> 7C, with parallel tracks for inbound-email auto-link, cold-leads MV + Today widget, and skill telemetry digest cycle 1.

Full week-by-week plan in `next-90-days-roadmap.md`.

## 7A.5-area issues found

The codebase pass surfaced three flags inside or adjacent to 7A.5 territory. Documented only; not fixed in this session per the no-touch list.

1. **Migration registry drift (HIGH).** ~17 prod-only timestamps post-Slice 7A, including 8 unaudited same-day entries (20260430063743 through 20260430064522). Audit artifacts under `~/crm/audit/2026-04-slice7a-migration-reconciliation/` show divergence between local and remote. LATER.md tracks the three-stage reconciliation plan: audit, repair vs pull per timestamp, push deferred migration `20260429194551_add_missing_timestamps.sql`. **Recommendation:** the dedicated 7A.5 plumbing session in flight is the right vehicle. Do not branch a parallel reconciliation.

2. **Six non-conforming migration filenames.** `phase-1.3.1-gmail-mvp.sql`, `phase-1.3.2-observation.sql`, `phase-1.4-projects.sql`, `phase-1.5-calendar.sql`, `phase-9-realtime-email-drafts.sql`, `slice-2a-drop-spine.sql`. The Supabase CLI silently skips files that do not match the `<14-digit-timestamp>_<name>.sql` pattern. Contents already applied to remote, so a `db reset` against a fresh local would diverge. **Recommendation:** rename to chronologically correct timestamp prefixes (or declare deleted if redundant), then `supabase migration repair --status applied <version>`. Low data risk; registry hygiene only.

3. **Untracked migrations under `audit/2026-04-slice7a-migration-reconciliation/`.** Five migration files plus a smoke harness committed under an audit subdir for trail purposes. Not a blocker; LATER.md documents this. Establishes the dated-subdir convention for future reconciliation work.

All three are inside the active 7A.5 scope. Surfacing them in case the 7A.5 plan does not already enumerate them; no action required from this session.

## Open questions for Alex's morning review

1. **Resend account setup status.** STATUS.md lists `RESEND_WEBHOOK_SECRET` as pending (project-memory: `project_resend_webhook_secret_pending.md`). What's the blocker, and is it resolvable this week? The roadmap assumes May Week 1 wiring.
2. **impeccable trial bake-in or dissolve.** Review was due 2026-05-01 (today). Decide: bake into re-landing-page / re-listing-presentation / slide-deck-generator / frontend-design preambles, or dissolve.
3. **design-intelligence trial extension.** Currently extended to 2026-05-28. Is the n>=2 threshold reachable by then, or should this dissolve early?
4. **task-list.tsx refactor priority.** Currently slotted v1.0 (June 19-25). Is that aggressive enough, or should it land before Slice 7C to set the refactor template earlier?
5. **Slice 8A scope.** content_calendar + social_posts + podcast_episodes are scoped but not planned. Does the v2.0 timing (Q4) hold, or does the content engine become a v1.0 stretch goal?

## Self-audit results (Phase 3)

Run results:

- Em-dash codepoint scan (U+2014, U+2013): zero hits across all 8 files.
- Banned-word scan: zero hits across the prohibited word list in Standing Rule 7.
- Exclamation marks: zero in body content.
- Banned-pattern scan against the no-touch list: zero hits in product recommendations.
- Recommendation format: every recommendation in highest-leverage-opportunities.md, future-automation-roadmap.md, manual-work-elimination.md, ai-agent-improvement-plan.md, and system-friction-analysis.md has the six required fields populated (Why-it-matters, Impact, Complexity, Dependencies, Compounding, Timing).
- Read cold: this handoff doc reads cleanly without the other 7 files in context.

## File pointers

| File | Purpose |
|------|---------|
| `highest-leverage-opportunities.md` | Top 10 ranked + 10 runner-ups, each with the 6-field format |
| `manual-work-elimination.md` | 10 repeated tasks with current cost and reduction target |
| `future-automation-roadmap.md` | Quarter-by-quarter through 2026-Q4 |
| `system-friction-analysis.md` | 25 named frictions across CRM, skills, ops, design |
| `ai-agent-improvement-plan.md` | Skill consolidation, prompt patterns, trial decisions |
| `next-90-days-roadmap.md` | Week-by-week May, June, July 2026 |
| `v1-to-v2-strategy.md` | Explicit cut-line; what ships v1.0 vs what waits |
| `overnight-agent-handoff.md` | This file |

## Verification commands Alex can run

```bash
ls ~/crm/docs/executive/
wc -l ~/crm/docs/executive/*.md
cd ~/crm && git status --short | grep -v "^.. supabase/migrations/" | grep -v "^.. audit/"
grep -rinP "[\x{2013}\x{2014}]" ~/crm/docs/executive/ || echo "no em or en dashes"
grep -rin "stunning\|breathtaking" ~/crm/docs/executive/ || echo "no Standing-Rule-7 banned-word hits"
```

Expected: 8 files; sizes between roughly 200 and 700 lines each; zero git changes outside `docs/executive/`; zero hits on dash and banned-term scans.

## Remaining placeholders

None.
