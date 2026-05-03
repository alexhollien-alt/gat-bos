# System Friction Analysis

Where humans wait, retype, context-switch, or re-explain. Each friction is named, tied to a system (CRM, skills, ops, design), and traceable to either a project-memory entry, a STATUS log, or a code artifact found in the codebase pass.

Format per item:
- **Where it lives** -- the system surface
- **Why it matters** -- the cost in time and trust
- **Impact** -- High / Medium / Low
- **Complexity** -- High / Medium / Low to fix
- **Dependencies** -- gates or other items that must land first
- **Compounding effects** -- what breaks free once this clears
- **Timing** -- before-v1.0, v1.0, after-v1.0

## Inventory by system

### CRM frictions

1. SQL paste-and-mirror to the Supabase SQL Editor (28 paste files in archive)
2. Migration registry drift requiring multi-day plumbing windows
3. Inbound email -> contact link is per-draft manual work
4. Cold-lead detection requires reading the morning brief
5. Property address re-entry from project to opportunity
6. Captures contact-match silent failure
7. Calendar attendee staleness on contact email change
8. Task-list.tsx blast radius on every task feature change
9. /today vs /today-v2 cutover stalled
10. Health score lag during bulk activity_events inserts

### Skill ecosystem frictions

11. 169 skills installed, ~21 used; long tail of n=1 skills
12. Skill audits run by hand each time
13. Multiple SEO skills with overlapping triggers (~20 in family)
14. Multiple design-review skills (5) with mode confusion
15. Telemetry hook is installed but no analysis cadence

### Ops frictions

16. Resend wiring blocked since 2026-04-03
17. Template polish-sweeps consume multi-session cycles
18. Agent commitments tracked in conversation, not in a queue
19. Paste-files accumulate before periodic archive sweeps
20. Long-lived trial skills with deferred decision gates

### Design frictions

21. Three-draft polish protocol per piece (locked, not a bug, but a cost)
22. Design-skill post-output logging gap (fixed in config 2026-04-19; awaiting first organic ship)
23. Recurring color/font reconciliation (Playfair to Instrument Serif, GAT Red/Blue swaps)
24. Headshot mask CSS exception in email (fallback to circle crop)
25. Three trial skills with overlapping audits (impeccable, design-intelligence, design-critique)

---

## Detailed treatment

### 1. SQL paste-and-mirror to Supabase SQL Editor

**Where it lives.** CRM. 28 SQL files in `~/Archive/paste-files/` over recent weeks; most are migrations or RLS work that should have flowed through `supabase migration new` + `supabase db push`.

**Why it matters.** Every paste is a tab-switch, a copy step, a paste step, a manual run, and a manual confirm. Five to ten minutes per paste. Compounds into the registry drift that 7A.5 is now reconciling.

**Impact.** High. Eliminates a category of multi-minute-per-action friction.
**Complexity.** Low. Standing Rule 23 already names the CLI as exclusive; the work is enforcement.
**Dependencies.** 7A.5 ships first.
**Compounding effects.** Eliminates the registry drift loop. Recovers paste-cycle time.
**Timing.** Before-v1.0.

### 2. Migration registry drift

**Where it lives.** CRM. 17 prod-only timestamps + 6 phase-prefixed files + ~44 unapplied local files.

**Why it matters.** When `supabase db reset` cannot complete, every feature slice that depends on a clean local DB stalls. 7B is paused on this exact blocker.

**Impact.** High.
**Complexity.** Low (post-7A.5 enforcement gate).
**Dependencies.** 7A.5.
**Compounding effects.** Unblocks 7B, which unblocks 7C, which unblocks 8A.
**Timing.** Before-v1.0.

### 3. Inbound email -> contact link

**Where it lives.** CRM `email_drafts` lifecycle.

**Why it matters.** Per-draft manual click. Drafts that should be linked stay decoupled, which means activity_events does not fire, which means the relationship-health refresh trigger does not run, which means the agent's health score lags reality.

**Impact.** High.
**Complexity.** Low.
**Dependencies.** None.
**Compounding effects.** Health score becomes timely. Relationship health widget stops lying.
**Timing.** Before-v1.0.

### 4. Cold-lead detection requires reading the morning brief

**Where it lives.** CRM Today View, morning briefing skill.

**Why it matters.** The brief runs once daily at 12:30 MST. Cold-lead identification between briefs is invisible.

**Impact.** Medium.
**Complexity.** Low.
**Dependencies.** None.
**Compounding effects.** Today widget surfaces real-time cold leads. Morning brief gets a deterministic baseline.
**Timing.** Before-v1.0.

### 5. Property address re-entry

**Where it lives.** CRM opportunity creation form.

**Why it matters.** ~30-60 seconds per opportunity, plus address-format drift across rows.

**Impact.** Medium.
**Complexity.** Low.
**Dependencies.** None.
**Compounding effects.** Address normalization across opportunities + projects becomes reliable.
**Timing.** Before-v1.0.

### 6. Captures contact-match silent failure

**Where it lives.** CRM captures rules parser.

**Why it matters.** Voice captures with misspellings or partial names yield contact_id null. The capture floats; downstream activity_events writes do not fire.

**Impact.** Medium.
**Complexity.** Low.
**Dependencies.** None.
**Compounding effects.** Capture data quality improves. Fewer orphan rows.
**Timing.** After-v1.0.

### 7. Calendar attendee staleness

**Where it lives.** CRM events table; jsonb attendees.

**Why it matters.** Silent failure when a contact email changes. Invites go to old addresses; agent says "I never got your invite"; trust hit.

**Impact.** Medium.
**Complexity.** Medium.
**Dependencies.** None.
**Compounding effects.** Contact-record updates become trustworthy.
**Timing.** After-v1.0.

### 8. task-list.tsx blast radius

**Where it lives.** `src/components/dashboard/task-list.tsx` (979 LOC).

**Why it matters.** Every task-related feature touches this file. The blast radius is the entire dashboard. Three other files (intake/page.tsx 728, contacts/[id]/page.tsx 679, analytics/page.tsx 923) have the same shape and will need the same treatment.

**Impact.** Medium.
**Complexity.** Medium.
**Dependencies.** 7B account scoping landed.
**Compounding effects.** Sets the refactor template for the other three hotspots.
**Timing.** v1.0 launch.

### 9. /today vs /today-v2 cutover stalled

**Where it lives.** CRM. /today legacy + /today-v2 modern; mutations on v2 deferred.

**Why it matters.** Two routes, two surfaces, one set of users. Confusion; bug-fix in two places.

**Impact.** Medium.
**Complexity.** Medium.
**Dependencies.** 7B contact-scoping changes. weeklyWhere() helper migration (LATER.md).
**Compounding effects.** Single Today surface. Half the dashboard maintenance cost.
**Timing.** v1.0 launch.

### 10. Health score lag during bulk inserts

**Where it lives.** `relationship_health_scores_refresh_trigger` on activity_events.

**Why it matters.** Trigger fires per-event; bulk inserts (e.g., contact import or paste-and-mirror cycles) cause refresh storms.

**Impact.** Low (today; rises with scale).
**Complexity.** Medium (debounce or refresh queue).
**Dependencies.** None.
**Compounding effects.** Bulk contact import becomes safe.
**Timing.** After-v1.0.

### 11. Skill long tail (15+ n=1 skills)

**Where it lives.** Skill ecosystem. 169 installed; 21 used in last 200 telemetry entries.

**Why it matters.** Larger index, slower routing, more mis-routes.

**Impact.** Medium.
**Complexity.** Low (monthly cadence + manual decisions).
**Dependencies.** Telemetry hook installed; ~1-2 weeks more data.
**Compounding effects.** Lower ambient context cost; faster session start.
**Timing.** Before-v1.0.

### 12. Skill audits manual

**Where it lives.** Skill ecosystem.

**Why it matters.** No audit cadence means no consolidation. The 2026-04-16 audit named 5+ clusters; nothing has shipped.

**Impact.** Medium.
**Complexity.** Low.
**Dependencies.** Telemetry data.
**Compounding effects.** Drives the long-tail prune.
**Timing.** Before-v1.0.

### 13. SEO family overlap

**Where it lives.** Skill ecosystem. ~20 SEO-prefixed skills.

**Why it matters.** Trigger overlap; mis-routes.

**Impact.** Low (most don't fire often).
**Complexity.** Medium (router skill + sub-domain libraries vs separate skills).
**Dependencies.** Telemetry digest.
**Compounding effects.** Cleaner SEO surface; less routing ambiguity.
**Timing.** v1.0 launch.

### 14. Design-review mode confusion

**Where it lives.** Skill ecosystem. design-critique, design-intelligence, design-proofing, impeccable (trial), visual-qa.

**Why it matters.** Five separate invocations; trigger overlap. 2026-04-16 audit named this.

**Impact.** Medium.
**Complexity.** Medium (unified QC gate with mode selection).
**Dependencies.** Trial closures (impeccable due 2026-05-01; design-intelligence due 2026-05-28).
**Compounding effects.** One-and-done audit instead of three-and-merge.
**Timing.** v1.0 launch.

### 15. Telemetry analysis cadence missing

**Where it lives.** Skill ecosystem. `~/.claude/telemetry/skill-invocations.jsonl`.

**Why it matters.** Hook fires; data accumulates; no consumer. The data is the input to items 11-14.

**Impact.** Medium.
**Complexity.** Low.
**Dependencies.** None (the telemetry already exists).
**Compounding effects.** Drives every skill consolidation decision.
**Timing.** Before-v1.0.

### 16. Resend wiring blocked since 2026-04-03

**Where it lives.** Ops. Onboarding sequence, Closing Brief, Monthly Toolkit, Weekly Edge, four quarterly drips.

**Why it matters.** The largest dark surface in the system. Every week dark, the content backlog grows.

**Impact.** High.
**Complexity.** Low.
**Dependencies.** Alex's account setup at Resend.
**Compounding effects.** Activates campaign-runner cron, templates abstraction, message_events ingestion. Feeds engagement metrics.
**Timing.** Before-v1.0.

### 17. Template polish-sweeps

**Where it lives.** Ops + design.

**Why it matters.** Recurring multi-session cycles. Project-memory names "GAT Red/Blue swaps, Playfair Display -> Instrument Serif" as recurring patterns.

**Impact.** Medium.
**Complexity.** Medium (template versioning + re-render).
**Dependencies.** Slice 4 templates.
**Compounding effects.** Template iteration becomes safe; sweeps become single-session.
**Timing.** After-v1.0.

### 18. Agent commitments tracked in conversation

**Where it lives.** Ops. Tasks live in the system; agent commitments often live in chat threads or memory.

**Why it matters.** Promises slip when they aren't queued. The cypher-ticket-builder skill bridges this for print production; nothing analogous for non-print commitments.

**Impact.** Medium.
**Complexity.** Medium.
**Dependencies.** None directly; benefits from 7C agent portal.
**Compounding effects.** Commitment fulfillment becomes measurable; agent trust compounds.
**Timing.** After-v1.0.

### 19. Paste-files accumulate

**Where it lives.** Ops. Standing Rule 22 already mandates archival after paste; the gap is detection.

**Why it matters.** Stale paste-files on Desktop look executable; they aren't.

**Impact.** Low.
**Complexity.** Low.
**Dependencies.** None.
**Compounding effects.** Desktop stays clean; nothing dangerous to mistake-execute.
**Timing.** v1.0 launch.

### 20. Trial skills with deferred decision gates

**Where it lives.** Skill ecosystem. impeccable (2026-04-17 install, due 2026-05-01), design-intelligence (extended to 2026-05-28), design-critique (audit followups).

**Why it matters.** Trial overhead lingers; the decision to bake in or dissolve is gated on data that may already exist.

**Impact.** Medium.
**Complexity.** Low (read the friction logs; decide).
**Dependencies.** Trial review dates.
**Compounding effects.** Each closed trial bakes its findings into existing skills, simplifying the ecosystem.
**Timing.** v1.0 launch.

### 21. Three-draft polish protocol per piece

**Where it lives.** Design (Standing Rule 6, 13).

**Why it matters.** Cost is intentional; output quality is high. Not a bug.

**Impact.** N/A (locked policy).
**Complexity.** N/A.
**Dependencies.** N/A.
**Compounding effects.** Quality compounds at the agent-relationship level; this is the cost.
**Timing.** Locked.

### 22. Design-skill post-output logging gap

**Where it lives.** Design. 6 design skills supposed to append to media-memory and wiki.

**Why it matters.** Fixed in config 2026-04-19 but awaiting first organic ship to verify.

**Impact.** Medium.
**Complexity.** Low (verification gate, not new code).
**Dependencies.** Next shipped design piece.
**Compounding effects.** Design history becomes searchable; past-work strip on contact pages becomes accurate.
**Timing.** Before-v1.0.

### 23. Recurring color and font reconciliation

**Where it lives.** Design. Templates and brand tokens.

**Why it matters.** Multiple sessions consumed each time. Roots: brand.md drift between sessions, copies in agent CONTACT.md, copies in templates.

**Impact.** Medium.
**Complexity.** Medium.
**Dependencies.** Template versioning (item 8 in highest-leverage).
**Compounding effects.** Brand iteration becomes safe.
**Timing.** After-v1.0.

### 24. Headshot mask email fallback

**Where it lives.** Design. Email clients do not support gradient masks; circle crop is the documented exception.

**Impact.** N/A (locked policy).
**Complexity.** N/A.
**Dependencies.** N/A.
**Timing.** Locked.

### 25. Three trial skills overlapping

**Where it lives.** Skill ecosystem. impeccable + design-intelligence + design-critique all chain on screen surfaces.

**Why it matters.** Three review passes per piece; rubrics overlap; decision overhead.

**Impact.** Medium.
**Complexity.** Low (close trials per their review dates and consolidate).
**Dependencies.** Trial review dates.
**Compounding effects.** Single quality gate; faster ship cycles.
**Timing.** v1.0 launch.

## Remaining placeholders

None.
