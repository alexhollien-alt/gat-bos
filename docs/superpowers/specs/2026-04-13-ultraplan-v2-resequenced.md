# GAT-BOS Ultraplan v2 -- Resequenced

**Date:** 2026-04-13
**Status:** Locked
**Supersedes:** `2026-04-12-ultraplan-design.md` (phase order + scope of calendar, inbox, portal, archetype system)
**Owner:** Alex Hollien
**Context this spec answers:** After stress-testing v1, seven decisions were revisited and locked. Calendar AI is deferred. The portal and intake collapse into one surface. The 12-personality placeholder system is retired in favor of the existing 14-archetype library plus a new 12-question self-serve quiz. Phase 7 is scoped down to clipboard-to-Cypher only, with Layout DNA vocabulary folded in.

---

## North Star (unchanged)

Alex sits down Monday morning, opens the CRM, and the system has already identified who is going cold, queued the right follow-ups, staged closing-day actions, and drafted tiered emails for batch approval. He acts on what surfaces. He does not decide what to act on.

v2 tightens the output layer: every agent-facing deliverable is archetype-tailored, every self-serve path runs through one portal, and every print handoff carries explicit Layout DNA so Cypher gets a tighter brief.

---

## The Seven Locked Decisions

| # | Decision | v1 Position | v2 Lock |
|---|----------|-------------|---------|
| 1 | Calendar v1 | AI auto-scheduling proposed | Visibility plus CRM context overlay only. No AI scheduling. |
| 2 | Inbox queue | Full triage pipeline | Claude filters for "actually needs a reply." That is the whole job. |
| 3 | Email sending | Mixed auto and manual | Drafts only for one-offs. CRM and drip campaigns can auto-send. |
| 4 | Intake vs. portal | Two surfaces | One resource hub. Standardized UI. Agents self-serve when Alex is unavailable. |
| 5 | Deliverables | Generic templates | Archetype-tailored per contact. |
| 6 | Archetype system | 12-personality placeholder expected | Use existing 14 archetypes. Build new 12-question self-serve quiz. Deprecate Obsidian 12-personality shell. |
| 7 | Phase 7 scope | Full skill pipeline | Clipboard-to-Cypher only. Skill pipeline is someday-maybe. Layout DNA vocabulary from spatial reasoning report baked into ticket format. |

---

## Decision 1 -- Calendar v1

**What ships:** Visibility layer. Google Calendar events rendered inside the CRM with contact context pulled from `contacts` (tier, last interaction, open deals, open tickets, open commitments).

**What does not ship:** AI auto-scheduling, time-block optimization, conflict resolution, automatic meeting prep generation.

**Why:** AI scheduling is a fifth-order problem. The first-order problem is "when I see an event, I want the CRM context for who I am meeting with." Solving that removes the main source of context-switching cost. Scheduling automation can be added later if the visibility layer proves insufficient.

**Dependencies:** Google Calendar OAuth, existing `contacts` read path, a calendar view component.

---

## Decision 2 -- Inbox Queue

**What ships:** Claude reads incoming email threads and surfaces only the ones that actually need a reply from Alex. Everything else stays in Gmail.

**Signal rules (first pass):**
- Direct question asked of Alex
- Request for a deliverable, scheduling, or decision
- Escalation language from an agent Alex represents
- New contact reaching out cold

**What does not ship:** Auto-drafting replies to inbox items. Categorization beyond "needs reply / does not need reply." Mass triage. Folder automation.

**Why:** The bottleneck is not "I have too many emails." It is "I cannot tell which of these 60 threads is the one that matters today." Solving the signal problem captures 80 percent of the value.

---

## Decision 3 -- Email Sending

**Two modes, locked:**

| Mode | Source | Send Behavior |
|------|--------|---------------|
| One-off | Alex-authored in the CRM or drafted via adviser strategy | Draft only. Alex clicks send. |
| Campaign / drip | CRM campaign executor, Weekly Edge, signal-triggered sequences | Auto-send on schedule after initial approval of the sequence. |

**Why:** One-offs carry relationship nuance that must be reviewed. Campaign sequences were already approved at enrollment. Mixing those policies caused the v1 "did Claude send that?" panic.

**Dependencies:** Existing Resend infra, campaign executor, webhook events feeding `health_score`.

---

## Decision 4 -- Intake Plus Portal = One Resource Hub

**What ships:** A single agent-facing surface. Current `/intake` evolves into the portal. Every self-serve path the agent needs lives here.

**Contents:**
- Resource library (past deliverables, templates, brand assets)
- Self-serve archetype quiz (Decision 6)
- Request form for new deliverables (feeds Phase 7 ticket builder)
- Active work status (tickets in flight, expected delivery)
- Direct message to Alex (becomes inbox queue input)

**What does not ship:** Separate portal domain, separate authentication system, separate UI theme. One surface, one UI, one auth path.

**Why:** Two surfaces doubled the onboarding cost for every new agent and split the "where do I go" decision. Collapsing them removes that friction and gives Alex one place to monitor agent activity.

**Dependencies:** Existing `/intake` page, showcase tier design tokens, Supabase auth for agent accounts.

---

## Decision 5 -- Archetype-Tailored Deliverables

**What ships:** Every agent deliverable (flyer, email, landing page, presentation) pulls three fields from the contact record:

```
contacts.primary_archetype      -- drives type expression axis
contacts.modifier_archetype     -- secondary influence, optional
contacts.color_palette          -- from brand.md agent palettes
```

Design skills read these fields and apply archetype-specific modulation on top of the base font kit defined in `brand.md`.

**Why:** v1 generic templates forced Alex to manually modulate every deliverable. Tailoring at data-model level pushes that work into the template system once and keeps it consistent forever.

**Dependencies:** Decision 6 (archetype system), design skill updates to read archetype fields.

---

## Decision 6 -- Archetype System Consolidation

### Current state (audit)

| File | Status |
|------|--------|
| `~/Documents/Alex Hub(Obs)/docs/architecture/design-archetypes.md` | Built and detailed. 14 archetypes, 5 design axes each, 6-question diagnostic. |
| `~/Documents/Alex Hub(Obs)/wiki/personalities/_index.md` | Empty shell. 12 placeholders, all fields `[PLACEHOLDER]`. |
| `~/Downloads/ai-design-spatial-reasoning-report.md` | Informational. Contains Layout DNA vocabulary relevant to Phase 7, not a personality test. |

### Locked consolidation

1. **Keep the 14-archetype library** as the source of truth. It is already written with detail across five axes (Type Expression, Color Temperature, Layout Tension, Photographic Mode, Voice Register).
2. **Build a 12-question quiz** that maps respondent answers onto the 14 archetypes. Expansion from the existing 6-question diagnostic. More granular because the quiz runs self-serve in the portal with no creative director guiding.
3. **Deprecate** `~/Documents/Alex Hub(Obs)/wiki/personalities/_index.md`. Replace its contents with a redirect note pointing to the 14-archetype file. Preserve the file path so any existing inbound links do not 404.
4. **Store results on contact record:**
   - `primary_archetype` (text, one of 14)
   - `modifier_archetype` (text, nullable, one of 14)
   - `color_palette` (text, one of six from `brand.md`)
   - `archetype_assigned_at` (timestamp)
   - `archetype_source` (enum: `quiz_self_serve`, `alex_assigned`, `diagnostic_6q`)

### Quiz architecture (Phase 6 portal)

- 12 questions, each with 3-5 answer choices
- Each answer carries weighted scores across the 5 design axes
- Final score produces a primary archetype and optional modifier (if the second-place score is within a threshold)
- Result page shows the archetype card, sample deliverables in that archetype, and a "this feels right / let me retake" confirmation

**Question design (deferred to build phase):** Questions map to the 5 axes. Two to three questions per axis. Plus two calibration questions for color palette and one for voice register.

**Flag:** `[PLACEHOLDER: 12 question text + answer weighting table -- build during Phase 6]`

### Deprecation checklist

- [ ] Rewrite `wiki/personalities/_index.md` as a redirect stub
- [ ] Update any CRM code referencing `personality_id` to `primary_archetype`
- [ ] Migration: add archetype columns to `contacts` if not present
- [ ] Backfill existing contacts via Alex-assigned values (see "Archetype assignment pending" memory)

---

## Decision 7 -- Phase 7 Scope: Clipboard to Cypher Only

### What ships

A ticket builder that takes a structured set of inputs (contact, archetype, deliverable type, listing data if any, headline, key copy, call to action) and produces a paste-ready Cypher ticket on the clipboard.

### What does not ship (yet)

- Full skill pipeline that auto-runs `re-print-design`, renders, and hands off to Cypher without human review
- Automated asset sourcing (photo selection)
- Automated proof cycles

### Layout DNA integration

The spatial reasoning report's Layout DNA vocabulary is baked directly into the Cypher ticket format. Each ticket carries explicit layout instructions using the DNA tokens so the Cypher designer has an unambiguous brief.

**Ticket additions (new section "Layout DNA"):**
- Grid tension (1-10 scale, archetype-derived)
- Type rhythm (monumental, editorial, technical, organic)
- Image-to-type ratio (percentage)
- Negative space budget (generous, balanced, dense)
- Focal hierarchy (single dominant, paired, distributed)

These five axes come straight from the archetype's design axes plus the spatial reasoning vocabulary. The ticket template auto-populates them from `primary_archetype` with optional override.

**Flag:** `[PLACEHOLDER: Layout DNA token mapping table -- pull exact definitions from spatial reasoning report during build]`

---

## Resequenced Phase Order

v1 phase order assumed the portal and calendar were heavy lifts. v2 reprioritizes around what removes the most friction per unit of build time.

| Phase | Scope | Why This Order |
|-------|-------|----------------|
| 1 -- Inbox queue | Decision 2: Claude filters for "needs reply" | Highest daily cost relief. No new data model. Reads Gmail, writes a queue. |
| 2 -- Archetype columns + data migration | Decision 5, 6 infra | Unblocks all tailored deliverables. Pure schema work. |
| 3 -- Calendar visibility layer | Decision 1 | Removes context-switching cost when scheduling or prepping meetings. |
| 4 -- Email sending policy enforcement | Decision 3 | Codifies the draft-vs-auto rule in code paths. Low build cost, high trust payoff. |
| 5 -- Portal consolidation (intake evolves) | Decision 4 | Requires archetype columns (Phase 2). Surfaces resource library and request form. |
| 6 -- Archetype quiz self-serve | Decision 6 | Lives inside the portal. Depends on Phase 5 surface being live. |
| 7 -- Clipboard to Cypher with Layout DNA | Decision 7 | Final output layer. Depends on archetype data (Phase 2) and portal request form (Phase 5). |

**Dependency chain:** 2 unblocks 5, 6, 7. 5 unblocks 6. All other phases can parallelize if Alex has the attention for it. Serial build is safer.

---

## Open Questions and Flags

**Archetype backfill.** Zero contacts currently have archetypes assigned (per memory `project_archetype_assignment_pending`). Decide before Phase 5 ships:
- Option A: Alex manually assigns all 126 contacts before portal launch. High cost, clean data.
- Option B: Portal launches with archetype quiz. Contacts self-assign on first visit. Lower cost, slower data accumulation.
- Option C: Hybrid. Alex assigns Tier A now, quiz handles the rest on first visit.

`[PLACEHOLDER: Alex to choose backfill strategy before Phase 5 build]`

**Color palette assignment.** The 6 agent palettes in `brand.md` (Classic Estate, Desert Modern, Contemporary Luxury, Organic Luxury, Editorial Luxury, Luxury Dark) need a mapping to archetypes so the quiz can auto-suggest a palette.

`[PLACEHOLDER: Archetype-to-palette suggestion map -- build during Phase 6]`

**Quiz retake policy.** If an agent retakes the quiz and gets a different result, does the old archetype get overwritten or versioned?

`[PLACEHOLDER: Archetype versioning policy -- decide during Phase 6]`

**Layout DNA token source of truth.** The spatial reasoning report is in `~/Downloads/`, not the Obsidian vault. Move it to `~/Documents/Alex Hub(Obs)/docs/architecture/` before Phase 7 build so it is reference-stable.

`[PLACEHOLDER: Move spatial reasoning report into vault before Phase 7]`

---

## Deprecations Triggered By v2

- `wiki/personalities/_index.md` placeholder system (Decision 6)
- Any v1 phase order documented in `2026-04-12-ultraplan-design.md` (this spec supersedes)
- Generic deliverable templates that do not read archetype fields (Decision 5)

---

## Placeholders Remaining

1. 12 question text plus answer weighting table (Phase 6 build)
2. Layout DNA token mapping table (Phase 7 build, after moving spatial reasoning report into vault)
3. Archetype backfill strategy (before Phase 5 ship)
4. Archetype-to-palette suggestion map (Phase 6 build)
5. Archetype versioning policy (Phase 6 decision)
6. Move spatial reasoning report into vault (before Phase 7)

---

## Sign-off

- v1 sunset: `2026-04-12-ultraplan-design.md` marked superseded by this file
- v2 effective: 2026-04-13
- Next action: Phase 1 (inbox queue) scoping session
