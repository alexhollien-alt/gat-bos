# GAT-BOS Backlog

**Purpose:** Anything queued that isn't in flight yet. Promote to ROADMAP.md when scheduled. Demote to ARCHIVED.md when killed.

**Last updated:** April 20, 2026

---

## Hot queue (next 30 days)

- [ ] ESLint exhaustive-deps warnings resolved before production push
- [x] Phase 1.3.1 Gmail OAuth app created in GCP
- [x] Phase 1.3.1 endpoints built and tested end-to-end
- [ ] DI trial review decision locked (commit, rollback, or extend)
- [ ] re-email-design skill Mailerlite references stripped
- [ ] re-email-design skill #C8102E replaced with canonical #b31a35
- [ ] Playfair Display drift in design-tokens files repaired (HIGH severity from system audit)

## CRM platform

- [ ] contact_tags table properly designed (deferred during Phase 1.2)
- [ ] CSV export button on Contacts page (Supabase handles it, UI missing)
- [ ] Global search across contacts + tasks + interactions
- [ ] Reports tab (not yet scoped)
- [ ] Title file lifecycle Kanban (contract received, opened, title work, balancing, signing, funding, recorded, closed)

## Email + content

- [ ] MJML block library built
- [ ] First live Weekly Edge campaign sent
- [ ] Closing Brief monthly cadence (2nd Thursday) wired
- [ ] 14-Day Onboarding Warm track activated
- [ ] 14-Day Onboarding Cold track activated
- [ ] Monthly Toolkit block content filled
- [ ] Partner Spotlight template populated
- [ ] INTAKE.md populated with first Weekly Edge content

## Skills system

- [ ] 100 unused skills audited and either merged, demoted, or archived
- [ ] Workspace forks folded into parent skills as evals/ subdirectories
- [ ] CLAUDE.md routing layer confirmed under 100 lines
- [ ] Standing rules injection verified in individual skill files
- [ ] Chain mode review after DI trial (keep in chain mode or fold into individual skills)

## Agent portal

- [ ] Mockup wired to live Supabase data
- [ ] Request-not-order flow (agents request design, Alex approves)
- [ ] Agent auth layer + tenant scoping
- [ ] Market snapshot widget pulling from market-intelligence skill
- [ ] Asset library per agent (past designs, brochures, landing pages)

## Voice + mobile

- [ ] /capture route (mobile-first voice memo capture)
- [ ] Transcription pipeline
- [ ] Claude processing + approve flow
- [ ] Write-back to contacts + interactions tables

## Calendar

- [ ] Google Calendar two-way sync
- [ ] Event push to relevant agents (open house, BNI)
- [ ] May-December agent education calendar events created as real calendar entries
- [ ] Christine-specific calendar variant (strips Stephanie references, neutral Partner Event chips)

## Analytics + scoring

- [ ] Relationship health scoring (PL/pgSQL trigger + Supabase Realtime)
- [ ] Escrow attribution tracking
- [ ] Engagement funnel dashboard
- [ ] Apple Mail Privacy Protection caveat noted on open-rate metrics

## Knowledge base + Obsidian

- [ ] Single-vault consolidation (pick one: .claude/knowledge-base or Alex Hub(Obs))
- [ ] Supabase as durable write layer once CRM is live
- [ ] 15-file Obsidian wiki package reviewed and trimmed

## Brand + design

- [ ] digital-aesthetic.md expanded and validated against re-landing-page
- [ ] Print archetype library (14 archetypes) fully populated with example outputs
- [ ] 6-question diagnostic questionnaire wired into agent-creative-brief skill

## Research + deep dives (all complete, pending integration)

- [x] Email deliverability playbook
- [x] Title industry differentiation
- [x] Social content + video attention strategy
- [x] Event to pipeline conversion
- [ ] Integrate findings into Weekly Edge structure + agent-bd skill

---

## Rules for this file

1. New ideas land here first. Not in ROADMAP. Not in chat.
2. Promote to ROADMAP.md only when a build slot is scheduled.
3. If an item sits here more than 90 days untouched, kill it or promote it. No purgatory.
4. No em dashes.
