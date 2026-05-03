# Future Automation Roadmap

Sequenced automation opportunities with dependencies. Quarter-by-quarter view through 2026-Q4. Each quarter assumes the prior quarter's gates landed; if a quarter slips, the next one slides.

Format per item:
- **Why it matters** -- what stays manual without it
- **Impact** -- High / Medium / Low
- **Complexity** -- High / Medium / Low
- **Dependencies** -- inside-roadmap or external
- **Compounding effects** -- what becomes possible after
- **Timing** -- which quarter

## Quarter view (2026)

| Quarter | Focus | Big bets |
|---------|-------|----------|
| 2026-Q2 (May, Jun) | Migration hygiene, email send live, contact auto-link, cold-leads MV, telemetry digest | Items 1, 2, 3, 4, 5 |
| 2026-Q3 (Jul, Aug, Sep) | Multi-tenant agent portal, template versioning, dashboard refactor, content engine foundation | Items 6, 7, 8, 9 |
| 2026-Q4 (Oct, Nov, Dec) | Content engine ship, referral attribution, post-event automation, derivative AI pipeline | Items 10, 11, 12, 13 |

---

## 2026-Q2 (May -- June)

### 1. Migration registry hygiene gate

**Why it matters.** Closes the dominant source of paste-files and prevents 7A.5 from recurring as a quarterly burst.
**Impact.** High.
**Complexity.** Low. Bash hook on `supabase migration list --linked` parsed for non-zero diff.
**Dependencies.** 7A.5 ships first. Standing Rule 23 already names the CLI as exclusive.
**Compounding effects.** Drives `supabase` adoption end-to-end. Eliminates the recurring registry-audit overhead.
**Timing.** May 2026.

### 2. Resend wiring + email send live

**Why it matters.** Unblocks every drip, every transactional, every Weekly Edge. Single largest dark surface in the system today.
**Impact.** High.
**Complexity.** Low. Webhook secret + API key. Slice 4 + 5A code is built.
**Dependencies.** Alex's Resend account setup.
**Compounding effects.** Activates Slice 5A campaign-runner cron, the templates abstraction, the message_events ingestion path. Closes the SQL paste-file loop for sends.
**Timing.** May 2026.

### 3. Inbound email -> contact auto-link

**Why it matters.** Closes a per-draft retyping loop and feeds the relationship-health refresh trigger.
**Impact.** High.
**Complexity.** Low. ~30 lines in the draft generator.
**Dependencies.** Slice 6 AI layer.
**Compounding effects.** Activity_events writes auto-fire on inbound, which trips health-score refresh, which lights the Today health widget without manual work.
**Timing.** May 2026.

### 4. Cold-leads materialized view + Today widget

**Why it matters.** Turns the morning-brief paragraph into a live Today tile. Faster reactivation.
**Impact.** Medium.
**Complexity.** Low. One MV + one widget.
**Dependencies.** Slice 7A user_id columns are in place.
**Compounding effects.** Provides a deterministic baseline for the morning brief to compare against. Foundation for reactivation automation later.
**Timing.** June 2026.

### 5. Skill telemetry monthly digest

**Why it matters.** 169 skills installed; only 21 invoked recently. Long-tail prune lowers ambient context cost on every session.
**Impact.** Medium.
**Complexity.** Low. Scheduled monthly job: jq group-by, flag n=1, write candidate list.
**Dependencies.** Telemetry hook installed (2026-04-16); ~1-2 more weeks of data needed for a usable signal.
**Compounding effects.** Each cycle reduces context cost; effect compounds over the year.
**Timing.** June 2026.

---

## 2026-Q3 (July -- September)

### 6. Slice 7B ship (multi-tenant contacts + 5 agent seed)

**Why it matters.** Unlocks 7C. Makes 5 agents addressable. Prerequisite for every partner-facing surface downstream.
**Impact.** High.
**Complexity.** Medium. Pre-flight 80% complete.
**Dependencies.** 7A.5 shipped (Q2).
**Compounding effects.** Account scoping becomes meaningful. Health-score per-account possible. Public agent landing pages possible.
**Timing.** July 2026.

### 7. Slice 7C ship (agent portal + magic links)

**Why it matters.** Switches the operating model from "Alex is the bottleneck" to "Alex reviews and approves." Self-serve agent surface.
**Impact.** High.
**Complexity.** High. New (portal) route group, magic-link auth, account_members multi-user, account-aware health.
**Dependencies.** 7B shipped. Resend wiring live (Q2 item 2). Slice 4 templates.
**Compounding effects.** Authenticated agent identity unlocks 8A content delivery and 8B referrals.
**Timing.** August 2026.

### 8. Template versioning + draft re-render

**Why it matters.** Makes template iteration safe. Ends the "send a draft and discover the template changed" failure mode.
**Impact.** Medium.
**Complexity.** Medium. Add version column, log on email_drafts, re-render path.
**Dependencies.** Slice 4 templates table.
**Compounding effects.** Template polish-sweeps go from weekend projects to single-session passes.
**Timing.** September 2026.

### 9. Dashboard hotspot refactor (task-list, intake, contacts detail, analytics)

**Why it matters.** Four files (979, 728, 679, 923 LOC) drive most of the future-feature blast radius. Refactoring them ahead of 8A keeps the dashboard manageable as content surfaces multiply.
**Impact.** Medium.
**Complexity.** Medium. Custom hooks, separated mutation handlers, no behavior change.
**Dependencies.** 7B account scoping landed so the refactor lands on stable RLS.
**Compounding effects.** Each subsequent hotspot refactor gets cheaper. 8A surfaces drop into a cleaner host.
**Timing.** September 2026.

---

## 2026-Q4 (October -- December)

### 10. Slice 8A content engine (content_calendar, social_posts, podcast_episodes)

**Why it matters.** Long-form to short-form derivative pipeline. Multiplies Alex's content output without multiplying Alex's hours.
**Impact.** High.
**Complexity.** High. Three new tables, derivative AI pipeline, attribution model.
**Dependencies.** 7C agent portal. Slice 4 templates. Slice 6 AI layer. Resend wiring.
**Compounding effects.** One Weekly Edge becomes 5-10 social posts plus 2-3 podcast snippets. Attribution closes the loop on which formats drive engagement.
**Timing.** October 2026.

### 11. Slice 8B referrals + post-event automation

**Why it matters.** Closes the referral attribution loop. Activates post-event drips. Captures RSVP and attendance.
**Impact.** High.
**Complexity.** High. New referrals table, RSVP/attendance schema (currently a roadmap gap), post-event automation hooks.
**Dependencies.** 8A shipped. Slice 5B event hooks. 7C portal for partner referral flows.
**Compounding effects.** Sponsor association becomes possible. Post-event automation unblocks the quarterly events cadence.
**Timing.** November 2026.

### 12. Reactivation automation (built on cold-leads MV)

**Why it matters.** Cold-leads MV (Q2 item 4) becomes the input for an automated nurture sequence. Cold lead enters a drip; if engaged, drops out; if dark for N more days, escalates to Alex.
**Impact.** High.
**Complexity.** Medium. Drip enrollment trigger on MV row insert. Escalation flag on email_drafts already exists.
**Dependencies.** Cold-leads MV. Resend live. Templates abstraction. 8A content available for the drip body.
**Compounding effects.** Closes the "agent goes dark, we notice next month" gap. Turns relationship-health metrics into actions.
**Timing.** December 2026.

### 13. Derivative AI pipeline (Slice 6 AI layer + 8A)

**Why it matters.** Long-form input -> AI generates short-form derivatives in the agent's voice. Slice 6 budget guard already exists, so AI cost stays bounded.
**Impact.** High.
**Complexity.** High. Prompts per format (social, podcast snippet, email teaser), agent voice modeling, derivative attribution.
**Dependencies.** 8A content_calendar shipped. 7C agent portal for voice modeling per agent. Slice 6 AI layer.
**Compounding effects.** Derivatives at marginal cost. Voice consistency across formats.
**Timing.** December 2026.

---

## Cross-quarter dependency graph

```
Q2: 7A.5 --> [migration gate, Resend wiring, contact auto-link, cold-leads MV, skill digest]
                                       |
Q3:                                    +--> Slice 7B --> Slice 7C --> [template versioning, hotspot refactor]
                                                                                                |
Q4:                                                                                              +--> Slice 8A --> Slice 8B --> [reactivation automation, derivative AI pipeline]
```

The critical chain: 7A.5 -> 7B -> 7C -> 8A -> 8B. Every Q2 item is parallel work that does not block the chain. Q3 hotspot refactor is parallel to 7C. Q4 reactivation is parallel to 8B. Slipping any chain item slides the whole quarter; slipping a parallel item only delays the parallel branch.

## Remaining placeholders

None.
