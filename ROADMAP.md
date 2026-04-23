# GAT-BOS Roadmap

**Repo:** GAT-BOS (Great American Title Business Operating System)
**Owner:** Alex Hollien
**Stack:** Next.js 14, TypeScript, Tailwind, shadcn/ui, Supabase, Vercel, Claude API, Resend
**Last updated:** April 23, 2026

---

## Current Phase

**Phase 1.3.2-D** -- Observation window (live). A/B/C shipped; D runs on calendar time, >=14 days + >=50 terminal drafts before Phase E readout.

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
- [x] Deployed to production (2026-04-20)

### 1.3 Gmail Integration
_Shipped end-to-end on 2026-04-19 (commit 85bf0ef)._

- [x] Phase 1.3.1 spec locked (ultraplan review complete)
- [x] Gmail OAuth credentials configured
- [x] /api/email/sync endpoint built
- [x] /api/email/generate-draft endpoint built
- [x] /api/email/approve-and-send endpoint built
- [x] Audit log writing verified
- [x] Phase 1.3.2 escalation flags (Marlene routing, agent prospect flag)
- [ ] Phase 1.3.3 manual approval dashboard UI

### 1.4 Projects Data Model
- [x] projects + project_touchpoints tables with soft-delete
- [x] RLS verified via negative-user test (2026-04-18)
- [x] /api/projects/* routes live
- [x] Dashboard tile: files-in-flight, files-closed

### 1.5 Calendar Foundation
- [x] Two-way Google Calendar sync shipped (Phase 7, 2026-04-18)
- [x] Events table wired
- [ ] Event push to agents (deferred to Phase 2.4)

### 1.6 Dashboard + Realtime
- [x] Unified dashboard cards (drafts-pending, projects-active, touchpoints-due)
- [x] Dashboard tiles: cold-agents, new-listings
- [x] Supabase Realtime wired on email_drafts
- [x] Lighthouse 100/100 on /today
- [x] Phase 9 prod acceptance gates PASS

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
_Shipped Phase 7, 2026-04-18._

- [x] Google Calendar MCP authenticated
- [x] Two-way sync with GAT-BOS events table
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

## GSD Plumbing Slices (tracked separately from product phases)

These are infrastructure / schema consolidation slices tracked via GSD phase numbering.

### Phase 001: Activity Ledger
- [x] Slice 1 -- activity_events canonical ledger, writeEvent helper, getContactTimeline (shipped 2026-04-22)

### Phase 002: Slice 2A -- Spine Drop
- [x] Slice 2A -- Remove spine infrastructure (spine_inbox, commitments, signals, focus_queue, cycle_state), delete spine API routes and lib files, clean today-client.tsx (shipped 2026-04-23)

### Phase 003: Slice 2B -- Captures Consolidation
**Plans:** 6 plans in 5 waves

Plans:
- [ ] 003-01-PLAN.md -- Git branch + migration file (data merge + schema changes)
- [ ] 003-02-PLAN.md -- TypeScript types (PromotedTarget, SuggestedTarget, ActivityVerb)
- [ ] 003-03-PLAN.md -- Refactor promote.ts (5 targets, adminClient, ensureProject)
- [ ] 003-04-PLAN.md -- Storage bucket check + cleanup-audio cron route
- [ ] 003-05-PLAN.md -- [BLOCKING] Push migration + typecheck + build verify
- [ ] 003-06-PLAN.md -- Commit + tag + PR

---

## Deadline Tracker

| Date | Item | Status |
|---|---|---|
| April 28, 2026 | DI trial review, commit or rollback | [x] Extended to 2026-05-28 on 2026-04-16 |
| April 28, 2026 | ESLint exhaustive-deps warnings cleared | [x] Cleared via cleanup passes 9-10 (commits 2feb16e, 2d59f61) |
| April 28, 2026 | Phase 1 contacts deployed to production | [x] Deployed 2026-04-20, aliased to gat-bos.vercel.app |

---

## Ship Target Dates (rough, not committed)

| Phase | Target |
|---|---|
| 1.3.1 Gmail MVP | Shipped 2026-04-19 (target was early May) |
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

---

## Remaining placeholders

Four unresolved placeholder markers remain in the Ship Target Dates table (rows for Phase 2.2 First Weekly Edge live, 2.3 Voice memo capture, 2.4 Calendar two-way sync, 3.3 Agent portal v1 live). All four are pending Alex's confirmation of ship dates.
