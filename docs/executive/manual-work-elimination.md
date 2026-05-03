# Manual Work Elimination

Repeated manual tasks across CRM, marketing, content, events, and dev workflow. For each task: current cost, automation candidate, expected reduction. Source signals: project-memory.md recurring themes, STATUS.md last 30-50 entries, paste-file archive contents, business-domain retyping risks, and skill-telemetry long tail.

Format per item:
- **Current cost** -- where time goes today
- **Why it matters** -- the downstream effect of the manual work
- **Impact** -- High / Medium / Low (after automation)
- **Complexity** -- High / Medium / Low (build cost)
- **Dependencies** -- what must land first
- **Compounding effects** -- what improves once this is automated
- **Timing** -- before-v1.0, v1.0, after-v1.0

## Inventory

| # | Task | Frequency today | Reduction target |
|---|------|-----------------|------------------|
| 1 | SQL paste-and-mirror to Supabase SQL Editor | 3-5 per week | Zero (CLI is the only path; gate enforces it) |
| 2 | Migration registry drift reconciliation | Quarterly burst (multi-day) | Continuous (post-merge hook flags drift in seconds) |
| 3 | Inbound email -> contact link | Per-draft manual click | Zero on exact-match; flag-only on multi-match |
| 4 | Cold-lead detection by reading the morning brief | Daily Alex-eyeballs | Zero (Today widget surfaces it directly) |
| 5 | Skill-ecosystem audits run by hand | Monthly hand audit | Zero (scheduled telemetry digest) |
| 6 | Email send unblock cycle (per template) | Weeks of stalled sends | Zero (Resend wiring + send path live) |
| 7 | Property address re-entry from project to opportunity | Per opportunity created from a listing | Zero (auto-populate from project metadata) |
| 8 | Template polish sweeps (color, font, copy) | Recurring multi-session | Drop ~80% (template versioning + re-render flag) |
| 9 | Calendar attendee staleness on email change | Silent failure | Flag-and-prompt on contact email update |
| 10 | Captures contact-match silent failure | Silent failure | Inline picker prompt when match fails |

---

## 1. SQL paste-and-mirror to Supabase SQL Editor

**Current cost.** 28 SQL files in the paste-file archive over the last few weeks, plus the 17 prod-only migrations being reconciled in 7A.5. Every paste cycle: write SQL, copy, switch tabs, paste, run, capture output, return, mark applied. 5-10 minutes per paste, error-prone for large DDL.

**Why it matters.** Every paste-and-mirror is one source of registry drift. The 7A.5 plumbing burst exists because this loop existed; preventing recurrence is more valuable than running 7A.5 cleanly once.

**Impact.** High. Eliminates a category of friction and a category of debt.

**Complexity.** Low. Standing Rule 23 already names the CLI as exclusive. The remaining work is a post-merge or pre-push gate that fails on drift. The Bash hook is small; the cultural enforcement is the harder half, but Rule 23 is already in place.

**Dependencies.** 7A.5 must ship to provide a clean baseline.

**Compounding effects.** Drives the migration-registry hygiene gate (item 2 below). Reduces the Archive paste-files cadence to near zero. Recovers the time spent on every paste-cycle for product work.

**Timing.** Before-v1.0.

## 2. Migration registry drift reconciliation

**Current cost.** Quarterly multi-day plumbing windows. 7A.5 itself is the second one in the last six weeks. Each one blocks downstream slices (7A.5 currently blocks 7B which blocks 7C).

**Why it matters.** Drift compounds silently. By the time a `supabase db reset` fails, the divergence is large enough to require an audit pass before any feature work resumes.

**Impact.** High. Removes a class of multi-day blockers.

**Complexity.** Low. Hook described in highest-leverage-opportunities.md item 1. The mechanism is `supabase migration list --linked` parsed for non-zero diff; the consumer is the post-merge or pre-push hook.

**Dependencies.** 7A.5 ships. Item 1 above (CLI exclusivity) reinforces it.

**Compounding effects.** Lets every future slice land cleanly. Eliminates the "audit before every feature" overhead that 7A.5 demonstrates.

**Timing.** Before-v1.0.

## 3. Inbound email -> contact link

**Current cost.** Per-draft manual association. `email_drafts.email.from_email` carries the sender; `email_drafts.contact_id` is null on most rows. Alex manually links or accepts decoupling.

**Why it matters.** Decoupled drafts skip the activity_events pathway, which means the relationship-health refresh trigger never fires for that interaction. Health scores lag reality by exactly the count of unlinked drafts.

**Impact.** High. Closes the per-draft retyping loop and feeds the health-score pipeline.

**Complexity.** Low. One lookup at draft generation. ~30 lines.

**Dependencies.** None. Slice 6 AI layer exposes the draft generator path.

**Compounding effects.** Auto-link populates activity_events through the existing writeEvent path, which trips relationship_health refresh, which trips the Today View health-score widget. Each link cascades into the health pipeline at zero additional cost.

**Timing.** Before-v1.0.

## 4. Cold-lead detection by reading the morning brief

**Current cost.** Cold-lead identification today is AI-driven through the morning brief. Alex reads the paragraph each morning to know which agents are going dark. The morning brief runs once per day at 12:30 MST; nothing surfaces between briefs.

**Why it matters.** Cold leads found at 9am Tuesday wait until Wednesday's brief if the brief is the only signal. The deterministic data exists in `agent_relationship_health` (or contacts.health_score + days_since_contact) right now; it just isn't surfaced.

**Impact.** Medium. Faster lead reactivation. Reduces dependence on the daily AI brief for high-priority lookups.

**Complexity.** Low. One MV `contacts_cold_leads` plus one Today widget. Refresh on the same trigger that powers `relationship_health_scores`.

**Dependencies.** None. Slice 7A user_id columns are in place. Slice 5B touchpoint cron is the analog.

**Compounding effects.** The morning brief gets a deterministic baseline to compare against. Reactivation automation (8B territory) gets a stable input.

**Timing.** Before-v1.0.

## 5. Skill-ecosystem audits run by hand

**Current cost.** 169 skills installed; 21 unique invoked in the last 200 telemetry entries. The 2026-04-16 audit named 5+ consolidation clusters (SEO ~20 skills, design review 5, Vercel 4 + 30 plugin, re-* design 5, Playwright 2). Audit deferred to "next telemetry pass." Manual review gate queued.

**Why it matters.** Skill-routing decisions check the index on every prompt; a longer index means slower routing and more mis-routes. The trim is recoverable but only if it actually runs.

**Impact.** Medium. Lower ambient session cost. Faster matching. Cleaner index.

**Complexity.** Low. Scheduled monthly job: jq group-by invocation count; flag n=1 candidates; write the candidate list to STATUS.md "Open questions" or a dedicated review queue. Decision step stays manual.

**Dependencies.** Telemetry hook is installed. Need ~1-2 more weeks of data for the first cycle.

**Compounding effects.** Every consolidation cycle reduces ambient context cost on every future session. Combined with the impeccable + design-intelligence trial closures (both due 2026-05-28 or earlier), the skill ecosystem can shrink without losing capability.

**Timing.** Before-v1.0.

## 6. Email send unblock cycle (per template)

**Current cost.** Email send blocked since 2026-04-03. Onboarding sequence, Closing Brief, Monthly Toolkit, Weekly Edge, four quarterly drips all stalled. Every week the wiring stays dark, the content backlog grows; agent relationship health depends entirely on Alex's manual outreach.

**Why it matters.** Manual outreach scales linearly with Alex's hours. The campaign-runner cron is built; the abstraction (`sendMessage()`) is built; templates are seeded. The only missing input is the wiring step.

**Impact.** High. Activates the entire campaign-automation stack.

**Complexity.** Low. Resend webhook secret + API key. Slice 4 + 5A code already handles the rest.

**Dependencies.** Alex's account setup at Resend.

**Compounding effects.** Closes the 28-paste-file friction loop. Provides measurable engagement metrics (opens, clicks) instead of relying on manual MV refresh.

**Timing.** Before-v1.0.

## 7. Property address re-entry from project to opportunity

**Current cost.** Listing projects carry property metadata (`projects.metadata.address` or related fields). When Alex creates an opportunity from a listing, the form re-asks for the property address. Per opportunity creation, ~30-60 seconds of typing already-stored data.

**Why it matters.** Typed addresses drift. "1234 N 12th Pl" vs "1234 N. 12th Pl." vs "1234 North 12th Pl." breaks any aggregation that joins on address.

**Impact.** Medium. Eliminates a per-opportunity retype. Removes a class of normalization bugs.

**Complexity.** Low. Pre-fill the opportunity form when invoked from a project context. ~one form change.

**Dependencies.** None.

**Compounding effects.** Opportunity rows align cleanly with project rows. Aggregations across the two tables (closings-today on deals, pipeline-value on opportunities) become reliable.

**Timing.** Before-v1.0.

## 8. Template polish sweeps (color, font, copy)

**Current cost.** Multi-session work cycles, recurring. Project-memory names "GAT Red/Blue swaps, Playfair Display -> Instrument Serif" as a repeated pattern. Each sweep means walking the templates table by hand, re-rendering, comparing.

**Why it matters.** Without versioning, every template edit has unknown blast radius. Drafts generated last week might already be sent against the prior version, and there is no record of which version was in effect when.

**Impact.** Medium. Drops the polish-sweep cost roughly 80%.

**Complexity.** Medium. Add `version` column to templates; log the version on each `email_drafts` row at generation time; add a one-click re-render path on drafts that reference an outdated version.

**Dependencies.** Slice 4 templates abstraction is in place.

**Compounding effects.** Template iteration becomes safe. Polish-sweeps go from weekend projects to single-session passes.

**Timing.** After-v1.0. v1.0 ships with hand-curated templates; versioning earns its keep at the second or third sweep.

## 9. Calendar attendee staleness on email change

**Current cost.** Silent failure today. `events.attendees` is jsonb pulled from gcal_event; no FK to contacts. When a contact email changes, the gcal_event attendee list does not update, and invites go to the old address.

**Why it matters.** A failed invite is invisible until the agent says "I never got your invite." Trust hit, and the cause is not obvious.

**Impact.** Medium. Closes a silent failure mode.

**Complexity.** Medium. Listen for `contacts.email` updates; query `events` for jsonb attendee entries matching the prior email; flag a UI prompt or auto-update the GCal event.

**Dependencies.** None directly. Slice 7A's account scoping covers the multi-tenant case.

**Compounding effects.** Contact-record updates become trustworthy. Reduces the "agent says they did not receive" cycle.

**Timing.** After-v1.0.

## 10. Captures contact-match silent failure

**Current cost.** Silent failure today. The captures rules parser builds a ContactIndexEntry array from live contacts at parse time and matches on first_name + last_name. Misspellings or partial names yield no match; contact_id stays null and the capture floats.

**Why it matters.** Voice captures that mention a known agent should attach to that agent automatically. When they do not, the capture context is lost.

**Impact.** Medium. Closes a silent failure mode in the capture pipeline.

**Complexity.** Low. Inline picker prompt when no exact match found, with a fuzzy-match shortlist. AI parser exists as a feature flag; this is the rules-path fallback, not a replacement.

**Dependencies.** Captures table and rules parser are stable.

**Compounding effects.** Capture data quality improves. Downstream surfaces (contact timeline, activity_events) get fewer orphan rows.

**Timing.** After-v1.0.

## Remaining placeholders

None.
