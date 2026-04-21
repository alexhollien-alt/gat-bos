# GAT-BOS Friction Log

**Purpose:** Open decisions, blockers, and known issues. Each item needs an Alex call before it can move. When resolved, move to RESOLVED section with date and decision.

**Last updated:** April 20, 2026

---

## Open decisions

### D1. DI trial outcome
**Question:** After April 28, do I commit the DI integration to individual skills permanently, roll back to pre-trial state using /tmp/di-build/ clones, or extend the trial?
**Blocker for:** Skill system stability, future skill rewrites
**Owner:** Alex
**Target decision date:** April 28, 2026

### D2. ESLint exhaustive-deps strategy
**Question:** Fix all warnings before production push, or suppress known-safe ones with eslint-disable-next-line and document them?
**Blocker for:** Phase 1.2 production deployment
**Owner:** Alex
**Target decision date:** April 27, 2026

### D3. contact_tags table design
**Question:** Many-to-many table with FK to contacts + tags, or JSON array column on contacts with GIN index?
**Blocker for:** Contact filtering, segmentation, campaign targeting
**Owner:** Alex
**Context:** Deferred during Phase 1.2 pending proper design

### D4. Obsidian vault consolidation
**Question:** Single vault at ~/Documents/Alex Hub(Obs)/ with Supabase as durable write layer, or keep dual-vault (.claude/knowledge-base + Alex Hub)?
**Blocker for:** RAG wiki stability, knowledge base reliability
**Owner:** Alex
**Context:** Two vaults currently exist. Recommended consolidation pending.

### D5. Phase 1.3.2 auto-send vs approval-required agents
**Question:** Which A-tier agents are pre-designated auto-send candidates (skip approval gate) vs always-require-approval?
**Blocker for:** Phase 1.3.2 escalation flag logic
**Owner:** Alex
**Context:** Currently spec says all drafts require approval. Auto-send tier is a Phase 2 question but worth deciding before 1.3.2 ships.

### D6. Voice memo storage
**Question:** Store raw audio in Supabase Storage, or transcribe immediately and discard audio?
**Blocker for:** Phase 2.3 voice memo capture
**Owner:** Alex
**Context:** Privacy and cost implications on both sides.

### D7. Agent portal auth model
**Question:** Supabase Auth with magic link, or separate auth tier (Clerk, Auth0) for agent-facing surface?
**Blocker for:** Phase 3.3 agent portal go-live
**Owner:** Alex

### D8. Title file Kanban scope
**Question:** Build a title file lifecycle Kanban (contract received through recorded) inside GAT-BOS, or keep that in SoftPro/Qualia and only pull summary data in?
**Blocker for:** Phase 2 or Phase 3 scope decision
**Owner:** Alex
**Context:** Title runs on files not deals. Current schema doesn't model files as a first-class entity.

### D9. Workspace forks handling
**Question:** Fold all workspace forks into parent skills as evals/ subdirectories, or keep them separate?
**Blocker for:** Skill system audit cleanup
**Owner:** Alex
**Context:** System audit flagged this as pending.

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

(Items move here when decided. Include date + decision.)

---

## Rules for this file

1. Every open item has a clear question, a blocker, and an owner.
2. When resolved, move to Resolved section with date + decision (one line).
3. If an item sits here more than 60 days untouched, escalate or kill.
4. No em dashes.
