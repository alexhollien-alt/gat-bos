# AI Agent Improvement Plan

Skill consolidation candidates from telemetry, routing fixes, prompt patterns to bake in, and recurring failure modes from project memory. Source: 169 skills installed, ~21 unique invoked in 200-entry telemetry sample, project-memory recurring themes, the 2026-04-16 skill-ecosystem audit, and the active impeccable + design-intelligence + design-critique trials.

Format per item:
- **Why it matters** -- the cost or risk today
- **Impact** -- High / Medium / Low
- **Complexity** -- High / Medium / Low
- **Dependencies** -- gates or other items
- **Compounding effects** -- what becomes possible after
- **Timing** -- before-v1.0, v1.0, after-v1.0

## Summary

| # | Item | Impact | Complexity | Timing |
|---|------|--------|------------|--------|
| 1 | Telemetry monthly digest + n=1 prune | Medium | Low | Before-v1.0 |
| 2 | SEO family consolidation (~20 skills -> router + libraries) | Medium | Medium | v1.0 |
| 3 | Design-review unification (5 skills -> single QC gate) | Medium | Medium | v1.0 |
| 4 | Vercel skill audit (4 local + 30 plugin) | Low | Low | Before-v1.0 |
| 5 | Re-* design skill shared post-output logging verification | Medium | Low | Before-v1.0 |
| 6 | Prompt patterns: external audit verification baked in | Medium | Low | Before-v1.0 |
| 7 | Prompt patterns: tool-routing reflex (Standing Rule 23 reinforcement) | High | Low | Before-v1.0 |
| 8 | Recurring failure: brand drift across surfaces | Medium | Medium | v1.0 |
| 9 | Recurring failure: skill audits with no follow-through | Medium | Low | Before-v1.0 |
| 10 | Recurring failure: paste-and-mirror muscle memory | High | Low | Before-v1.0 |

---

## 1. Telemetry monthly digest + n=1 prune

**Why it matters.** Hook fires; data accumulates; nothing reads it. The 169-skill index inflates ambient context cost on every session.

**Impact.** Medium.
**Complexity.** Low. Scheduled job: jq group-by, flag n=1, write candidate list to STATUS.md "Open questions" or a dedicated review queue.
**Dependencies.** Telemetry hook is installed (2026-04-16). Need ~1-2 more weeks of data for first cycle.
**Compounding effects.** Drives every consolidation decision. Effect compounds over the year as the index shrinks.
**Timing.** Before-v1.0.

## 2. SEO family consolidation

**Why it matters.** ~20 SEO-prefixed skills (audit, page, technical, sitemap, schema, hreflang, images, content, geo, local, planner, programmatic, competitor-pages, dataforseo, google, maps, image-gen, plan, backlinks, plus the umbrella `seo`). Trigger overlap creates routing ambiguity.

**Impact.** Medium. Reduces index size; cleans up routing.
**Complexity.** Medium. Router skill + sub-domain libraries pattern. Migration plan needs care because some sub-skills (seo-dataforseo, seo-google) wrap external services.
**Dependencies.** Telemetry digest data to confirm which sub-skills get used.
**Compounding effects.** SEO trigger routing becomes deterministic; sub-skill maintenance becomes easier.
**Timing.** v1.0.

## 3. Design-review unification

**Why it matters.** Five overlapping skills: design-critique, design-intelligence, design-proofing, impeccable (trial), visual-qa. Three of them are in active trial (impeccable due 2026-05-01; design-intelligence due 2026-05-28). Multiple invocations per piece; rubric overlap.

**Impact.** Medium.
**Complexity.** Medium. Single QC gate with mode selection (visual, accessibility, brand, performance, UX).
**Dependencies.** Trial closures land first. impeccable closes 2026-05-01; design-intelligence closes 2026-05-28; design-critique audit follow-ups noted.
**Compounding effects.** One review pass per piece. Faster ship cycles. Simpler skill index.
**Timing.** v1.0.

## 4. Vercel skill audit

**Why it matters.** Four local Vercel skills (vercel-deploy-to-vercel, vercel-react-best-practices, vercel-composition-patterns, vercel-web-design-guidelines) coexist with 30+ `vercel:*` skills loaded from the Vercel plugin. Some local skills may now be subsumed.

**Impact.** Low.
**Complexity.** Low. Read each local skill; check if the plugin equivalent covers it; deprecate or merge accordingly.
**Dependencies.** None.
**Compounding effects.** Cleaner skill index. Ambiguity removed.
**Timing.** Before-v1.0.

## 5. Re-* design skill shared post-output logging verification

**Why it matters.** Six design skills (re-print-design, re-email-design, re-landing-page, re-listing-presentation, canva-handoff, listing-pipeline) had a logging gap fixed in config 2026-04-19. The fix is awaiting first organic ship to verify it fires correctly.

**Impact.** Medium.
**Complexity.** Low. Verification gate; no new code.
**Dependencies.** Next shipped design piece.
**Compounding effects.** Design history becomes searchable; past-work strip on contact pages becomes accurate.
**Timing.** Before-v1.0.

## 6. Prompt patterns: external audit verification baked in

**Why it matters.** Standing Rule 16 names the "verify external LLM audits" requirement. The pattern is observed in Standing Rules but not all skill prompts reflect it. Costly when sessions act on stale audit claims.

**Impact.** Medium.
**Complexity.** Low. Audit skill prompts; bake the verification reflex into ones that ingest external audit content (drift-audit, weekly-audit, opponent-review).
**Dependencies.** None.
**Compounding effects.** Reduces wasted sessions chasing stale claims.
**Timing.** Before-v1.0.

## 7. Prompt patterns: tool-routing reflex

**Why it matters.** Standing Rule 23 names the Supabase CLI as exclusive; no MCP, no paste-files. The rule is loaded; the muscle memory is not always. Recurring failure mode in project memory: the urge to draft a paste-file SQL despite the rule.

**Impact.** High. The paste-and-mirror habit is the dominant source of registry drift.
**Complexity.** Low. Reinforce in skill prompts that touch Supabase work (e.g., postgresql-table-design, sql-optimization-patterns, database-migration). Tool-routing.md is auto-loaded; this is per-skill backup.
**Dependencies.** None.
**Compounding effects.** Every Supabase-touching skill defaults to CLI without re-stating the rule.
**Timing.** Before-v1.0.

## 8. Recurring failure: brand drift across surfaces

**Why it matters.** Project memory names "color/font reconciliation" as recurring. Brand tokens live in brand.md; copies live in agent CONTACT.md; copies live in templates. Each surface drifts independently.

**Impact.** Medium.
**Complexity.** Medium. Single source of truth + verify-brand.sh hook + token-update propagation. brand-audit skill exists; the gap is the verification cadence.
**Dependencies.** Skill audit cadence (item 1).
**Compounding effects.** Brand polish becomes a one-place edit instead of a sweep.
**Timing.** v1.0.

## 9. Recurring failure: skill audits with no follow-through

**Why it matters.** 2026-04-16 audit named 5+ consolidation clusters. Nothing has shipped. The audit is one form of work; the consolidation is another, and the bridge is missing.

**Impact.** Medium.
**Complexity.** Low. Audit cadence + decision queue (the digest in item 1) + a "decided but not shipped" flag in STATUS.md.
**Dependencies.** Telemetry digest cadence.
**Compounding effects.** Each audit produces shipped consolidations instead of backlog growth.
**Timing.** Before-v1.0.

## 10. Recurring failure: paste-and-mirror muscle memory

**Why it matters.** 28 paste-files in archive in recent weeks despite Standing Rule 23. The urge to draft SQL for the Supabase SQL Editor recurs.

**Impact.** High. This is the dominant source of registry drift.
**Complexity.** Low. Skill-prompt reinforcement (item 7) plus the post-merge hygiene gate from highest-leverage-opportunities.md.
**Dependencies.** 7A.5 ships; gate lands.
**Compounding effects.** Eliminates a category of friction and a category of debt.
**Timing.** Before-v1.0.

## Trial decisions due

- **impeccable trial** -- review 2026-05-01 via weekly-audit. Decide: bake into re-landing-page / re-listing-presentation / slide-deck-generator / frontend-design preambles, or dissolve. Friction log at `~/.claude/memory/project_impeccable_trial.md`.
- **design-intelligence trial** -- extended to 2026-05-28 via weekly-audit. Mid-trial correction applied 2026-04-30. Decide whether DI stays as chain pass or dissolves into parent skills.
- **design-critique** -- audit follow-ups noted 2026-04-30. Determine if Mode A and Mode B both bake in or only one survives.

## Remaining placeholders

None.
