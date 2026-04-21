# GAT-BOS Roadmap

**Repo:** GAT-BOS (Great American Title Business Operating System)
**Owner:** Alex Hollien
**Stack:** Next.js 14, TypeScript, Tailwind, shadcn/ui, Supabase, Vercel, Claude API, Resend
**Last updated:** April 20, 2026

---

## Current Phase

**Phase 1.3.1** — Gmail integration build. Spec complete, implementation pending. Deadline pressure: DI trial ends April 28.

---

## Phase 1: CRM Spine

### 1.1 Foundation
- [x] Next.js 14 project initialized (App Router, TS, Tailwind, shadcn/ui)
- [x] Supabase project connected (ref: rndnxhvibbqqjrzapdxs)
- [x] Email/password auth with protected routes
- [x] pnpm lockfile + folder structure committed
- [x] CLAUDE.md, SCHEMA.md, ROADMAP.md at repo root

### 1.2 Spine Data Model
- [x] 7-table schema deployed with RLS
- [x] /api/spine/* routes live
- [x] Contacts table seeded with 105 contacts
- [x] A/B/C/P tier distribution applied
- [x] Today View code-complete
- [x] Task 13 Contacts UX Polish merged
- [x] Contacts page grouped by tier (25 rows per section, Untiered at bottom)
- [ ] Deployed to production (blocked by ESLint warnings)

### 1.3 Gmail Integration
- [x] Phase 1.3.1 spec locked (ultraplan review complete)
- [ ] Gmail OAuth credentials configured
- [ ] /api/email/sync endpoint built
- [ ] /api/email/generate-draft endpoint built
- [ ] /api/email/approve-and-send endpoint built
- [ ] Audit log writing verified
- [ ] Phase 1.3.2 escalation flags (Marlene routing, agent prospect flag)
- [ ] Phase 1.3.3 manual approval dashboard UI

---

## Phase 2: Lifecycle Automation + Content

### 2.1 Lifecycle Rules
- [ ] Stage transition triggers defined in Supabase
- [ ] Auto-follow-up generation wired
- [ ] Temperature decay logic live

### 2.2 Email Campaign System
- [x] Resend migration complete (from Mailerlite)
- [x] Domain alexhollienco.com verified and warmed
- [x] Sender address alex@alexhollienco.com confirmed
- [x] Weekly Edge master template built
- [x] Closing Brief shell built
- [x] 14-Day Onboarding (Warm + Cold) spec written
- [x] HTML template zone architecture defined (8 zones)
- [ ] re-email-design skill Mailerlite references removed
- [ ] re-email-design skill #C8102E replaced with #b31a35
- [ ] MJML block library built
- [ ] First live Weekly Edge sent
- [ ] Closing Brief monthly send wired
- [ ] Onboarding drip campaigns active

### 2.3 Voice Memo Capture
- [ ] /capture route scaffolded
- [ ] Transcription pipeline wired
- [ ] Claude processing + review + approve flow

### 2.4 Calendar Sync
- [x] Google Calendar MCP authenticated
- [ ] Two-way sync with GAT-BOS events table
- [ ] Event push to agents (open house, BNI invites)

---

## Phase 3: Intelligence + Agent Portal

### 3.1 Analytics
- [ ] Escrow attribution tracking
- [ ] Engagement funnel dashboard
- [ ] Relationship health scoring (PL/pgSQL trigger + Realtime)

### 3.2 Content Recycling
- [ ] Past campaigns indexed
- [ ] Refresh/repurpose workflow

### 3.3 Agent Portal
- [x] UI mockup built (Dashboard, Transactions, Assets, Request Design, Market Snapshot, Messages)
- [ ] Wired to live Supabase data
- [ ] Request-not-order design flow (agents request, Alex approves)
- [ ] Agent auth + tenant scoping

---

## Phase 4: Ambient + Scale (not yet scoped)

Deferred until Phases 1 through 3 are fully live. Candidates include ambient Claude Code skill writing back to spine, /capture mobile-first surface, and new-contact AI enrichment.

---

## Deadline Tracker

| Date | Item | Status |
|---|---|---|
| April 28, 2026 | DI trial review — commit or rollback | [CHECK] |
| April 28, 2026 | ESLint exhaustive-deps warnings cleared | [CHECK] |
| April 28, 2026 | Phase 1 contacts deployed to production | [CHECK] |

---

## Ship Target Dates (rough, not committed)

| Phase | Target |
|---|---|
| 1.3.1 Gmail MVP | Early May 2026 |
| 1.3.2 Escalation + dashboard | Mid May 2026 |
| 2.2 First Weekly Edge live | [PLACEHOLDER: needs confirm] |
| 2.3 Voice memo capture | [PLACEHOLDER: needs confirm] |
| 2.4 Calendar two-way sync | [PLACEHOLDER: needs confirm] |
| 3.3 Agent portal v1 live | [PLACEHOLDER: needs confirm] |

---

## Rules for this file

1. Update after every ship. Move items from `[ ]` to `[x]` when deployed, not when coded.
2. Never delete a phase. Move to a "Deferred" section if dropped.
3. If a new item comes up mid-phase, add it to BACKLOG.md first. Promote to ROADMAP only when scheduled.
4. No em dashes.
