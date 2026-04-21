# GAT-BOS Friction Log

**Purpose:** Open decisions, blockers, and known issues. Each item needs an Alex call before it can move. When resolved, move to RESOLVED section with date and decision.

**Last updated:** April 20, 2026

---

## Open decisions

### D4. Obsidian vault consolidation
**Question:** Single vault at ~/Documents/Alex Hub(Obs)/ with Supabase as durable write layer, or keep dual-vault (.claude/knowledge-base + Alex Hub)?
**Blocker for:** RAG wiki stability, knowledge base reliability
**Owner:** Alex
**Context:** Two vaults currently exist. Recommended consolidation pending. **Parked 2026-04-20 per Alex.**

### D8. Title file Kanban scope
**Question:** Build a title file lifecycle Kanban (contract received through recorded) inside GAT-BOS, or keep that in SoftPro/Qualia and only pull summary data in?
**Blocker for:** Phase 2 or Phase 3 scope decision
**Owner:** Alex
**Context:** Title runs on files not deals. Current schema doesn't model files as a first-class entity. **Parked 2026-04-20 per Alex.**

### D9. Workspace forks handling
**Question:** Fold all workspace forks into parent skills as evals/ subdirectories, or keep them separate?
**Blocker for:** Skill system audit cleanup
**Owner:** Alex
**Context:** System audit flagged this as pending. **Parked 2026-04-20 per Alex.**

---

## Known issues

### I1. Playfair Display drift (HIGH severity)
**Symptom:** design-tokens files have inconsistent Playfair Display references
**Impact:** Print + digital design outputs may render with wrong font stack
**Owner:** Alex
**Surfaced by:** System audit

### I2. re-email-design skill stale references
**Symptom:** Skill still contains Mailerlite references and #C8102E color value
**Impact:** Any email template built from this skill needs manual correction
**Owner:** Alex
**Fix:** Update skill to reference Resend and #b31a35

### I3. 100 unused skills out of 148
**Symptom:** System audit flagged 100 skills as unused
**Impact:** Context bloat, stale references, routing confusion
**Owner:** Alex
**Fix:** Audit each, merge-demote-or-archive

### I4. Apple Mail Privacy Protection skew
**Symptom:** Open-rate metrics inflated by Apple's preload behavior
**Impact:** Engagement analytics in Phase 3 will over-report opens
**Owner:** System (Phase 3 scope)
**Fix:** Document caveat, prioritize click-through as primary engagement metric

---

## Resolved

D1. DI trial outcome. Resolved 2026-04-20. Decision: extended through 2026-05-28 per update logged 2026-04-16 in project_di_trial.md. /tmp/di-build/ clones retained through new review date.

D2. ESLint exhaustive-deps strategy. Resolved 2026-04-20. Decision: all warnings fixed via Bucket B (useMemo stabilization) in cleanup passes 9-10 (commits 2feb16e, 2d59f61). No suppressions added. pnpm lint clean.

D3. contact_tags table design. Resolved 2026-04-20. Decision: JSON array column on contacts + GIN index at current scale. Revisit when tag-filtered queries become a measurable bottleneck (slow segmentation scans or campaign target queries).

D6. Voice memo storage. Resolved 2026-04-20. Decision: transcribe immediately and discard raw audio. Retain audio only when replay is ever needed (not currently a requirement). Keeps storage cost and privacy surface minimal.

D7. Agent portal auth model. Resolved 2026-04-20. Decision: Supabase Auth with magic link. Simpler, no added vendor, consistent with existing CRM auth stack.

D5. Phase 1.3.2 auto-send vs approval-required agents. Resolved 2026-04-20. Decision: no one gets auto-send in 1.3.2. Approval gate stays on for every agent through one full cycle so we can observe where AI drafts actually land under volume. Auto-send promotion is a 1.3.3 decision, made per-agent after the observation window. Pre-named promotion candidates (for 1.3.3 evaluation, not yet active): Julie Jarmiolowski, Joey Hollien, Amber Hollien. Fiona Bigbee stays gated indefinitely because EDDM-focused sends are campaign-specific rather than routine. Phase 1.3.2 spec (to be written in its own plan) inherits this: escalation flag logic assumes approval-required for all; no auto-send branch in 1.3.2 code path.

---

## Rules for this file

1. Every open item has a clear question, a blocker, and an owner.
2. When resolved, move to Resolved section with date + decision (one line).
3. If an item sits here more than 60 days untouched, escalate or kill.
4. No em dashes.
