# GAT-BOS Ultraplan -- Master Build Sequence

**Date:** 2026-04-12
**Status:** Approved
**Goal:** A relationship intelligence engine that reads Alex's mind and thinks 8 steps ahead.

---

## North Star

Alex sits down Monday morning, opens the CRM, and the system has already:
- Identified who is going cold and why
- Queued the right follow-ups from last week's meetings
- Staged closing-day actions for any deals in escrow
- Drafted Tier A/B emails for batch approval

He acts on what the system surfaces. He does not decide what to act on.

---

## System Architecture (Four Layers)

```
LAYER 4: OUTPUT
  Skills: agent-bd, agent-strategy-session, morning-briefing, end-of-day-briefing
  Resend campaigns + Weekly Edge newsletter
  Print pipeline (Cypher tickets via cypher-ticket-builder)
  Intake page at /intake (agent-facing front door, showcase tier)

LAYER 3: ACTION SURFACE
  Today View -- 6-bucket daily command center (primary interface)
  Action Queue at /actions -- manual priority feed (already built)
  Dashboard -- bento command center (rebuild in Session 9)
  Morning briefing skill -- already works, gets smarter as data flows

LAYER 2: INTELLIGENCE
  Edge functions: parser / signal scan / Monday rotation
  Claude AI drafts via adviser strategy (infrastructure done, nothing wired yet)
  Campaign executor (auto-enrollment + step firing)
  Resend webhook -- email events feed health_score

LAYER 1: DATA
  Supabase: contacts, interactions, deals, opportunities
  cycle_state, focus_queue, signals, commitments, inbox
  campaigns, campaign_steps, campaign_enrollments
  agent_relationship_health materialized view
  agent_health coalesce view
```

### The Core Feedback Circuit

This is the loop that creates the "reading your mind" experience. Every other
feature (loyalty, going_cold, stalled_pipeline) follows the same pattern.

```
You log a meeting (interactions.insert, type='meeting')
  --> parser edge fn: extracts commitments --> commitments.insert
  --> signal scan: fires post_meeting_24h --> signals.insert
  --> Today View bucket 5: "Send follow-up to [agent]"
  --> campaign auto-enrollment: 7-touch sequence starts
  --> campaign executor: Touch 2 email fires via Resend at 24h
  --> Resend webhook: email.opened --> health_score +3, interaction logged
  --> cycle_state trigger: next_touch_due recalculated
  --> Monday rotation: contact lands in focus_queue
  --> Today View bucket 5: "Check in with [agent]" (Touch 4 call)
  --> You call, log it --> contact enters normal A/B/C cadence
  --> Today View surfaces at 7/10/14 day intervals forever
```

### What Is Closed Today

- Data model and schema (all tables exist, seeded)
- Health scoring (materialized view + coalesce view)
- Resend email infrastructure (safety lock active)
- 5 skills wired to CRM API
- Action Queue at /actions (manual priority feed)
- Ticket Workbench, basic analytics, intake page
- Adviser strategy infrastructure (createAdvisedCompletion built, nothing wired)

### What Is Not Closed

- 3 edge functions (intelligence does not fire)
- Today View UI (shell exists at /today, no widgets)
- Campaign executor (sequences do not run)
- Loyalty loop (deals do not trigger anything)
- GitHub remote (no version control safety net)
- RESEND_WEBHOOK_SECRET (email feedback loop broken)
- MV lockdown SQL (needs manual Supabase paste)

---

## Build Sequence (10 Sessions)

Dependency chain is strict: no session starts until the previous one
delivers its standalone module.

```
S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7 --> S8 --> S9 --> S10+
```

---

### Session 1 -- Unblock Everything (~1.5 hours)

**Goal:** Remove all friction that would slow future sessions.

Tasks:
1. Create GitHub repo, configure remote origin, push `feat/spine-phase1`
2. Set `RESEND_WEBHOOK_SECRET` in Vercel env vars
3. Paste MV lockdown SQL into Supabase SQL editor (file: `supabase/` -- verify which piece)
4. Clean duplicate contacts (2x Julie Jarmiolowski confirmed; audit for others)

**What you can use after:** CRM is in version control. Email open/click events
start flowing into health scores via Resend webhook.

**Success check:** `git remote -v` shows origin. Supabase webhook handler returns
200 on a test delivery event.

---

### Session 2 -- Wire the Intelligence (~2.5 hours)

**Goal:** The system starts seeing and writing signals automatically.

Tasks:
1. Signal scan edge function (Supabase cron, 7am daily)
   - Writes `going_cold` when: Tier A no interaction 14+ days, Tier B 20+ days, Tier C 28+ days
   - Writes `stalled_pipeline` when: opportunities.stage unchanged 30+ days
   - Writes `closing_soon` when: deals.scheduled_close_date within 3 days
   - Idempotent: skip if unresolved signal of same type already exists for contact
2. Parser edge function (Supabase cron or pg_cron, every 15 minutes)
   - Reads inbox table where parsed = false
   - Calls Claude API (createAdvisedCompletion, featureKey: voiceMemo)
   - Writes extracted commitments to commitments table
   - Marks inbox rows parsed = true

**What you can use after:** Manually check signals table after next BNI meeting.
Going_cold agents appear without any manual work. The system is watching.

**Success check:** Insert a test interaction 15+ days in the past for a Tier A
contact. Trigger signal scan manually. Verify going_cold row in signals table.

---

### Session 3 -- Today View, Buckets 1-3 (~3 hours)

**Goal:** First real priority list on Monday morning.

Tasks:
1. Today View page at `/today` with TanStack Query + Supabase Realtime
2. Bucket 1 (red -- Overdue follow-ups): `follow_ups` where `due_date < now()` and not completed
3. Bucket 2 (orange -- Closings today/tomorrow): `deals` where `scheduled_close_date` within 2 days
4. Bucket 3 (yellow -- Agents going cold): `signals` where `type = 'going_cold'` and resolved = false
5. Per-item action row: agent name, tier badge, last touch date, action buttons (Call / Email / Skip)
6. Action buttons: log interaction + resolve signal + update cycle_state.last_touch_date
7. Digital Aesthetic v2 applied to Today View page (workspace tier, dense utility layout)

**What you can use after:** Open the CRM Monday and see your actual priority list,
populated from real data. Not a placeholder.

**Success check:** At least 1 going_cold agent appears in bucket 3 from Session 2
signals. Clicking "Skip" resolves the signal and removes it from the list.

---

### Session 4 -- Today View Buckets 4-6 + Monday Rotation (~2.5 hours)

**Goal:** Complete the Today View. The weekly rotation builds itself.

Tasks:
1. Monday rotation edge function (Supabase cron, Monday 6am)
   - Reads cycle_state for all Tier A/B/C contacts where next_touch_due within current week
   - Writes to focus_queue (unique per week, respects tier priority)
2. Bucket 4 (blue -- Scheduled meetings/calls): tasks + follow_ups where type in ('call','meeting') due today
3. Bucket 5 (green -- Proactive touchpoints): focus_queue current week + post_meeting_24h signals
4. Bucket 6 (gray -- Stalled pipeline): signals where type = 'stalled_pipeline' and resolved = false
5. "Mark done" on any item: logs interaction, resolves signal, updates cycle_state.last_touch_date

**What you can use after:** Full 6-bucket Today View live. Every Monday the
rotation builds itself. Open the CRM and the week is already organized.

**Success check:** Manually trigger rotation edge function. Verify focus_queue
has entries for the current week. Bucket 5 shows them.

---

### Session 5 -- Campaign Executor + 7-Touch Auto-Enrollment (~3.5 hours)

**Goal:** From "you met someone" to "the sequence runs itself."

Tasks:
1. Campaign step executor (Vercel cron or Supabase edge, runs every hour)
   - Reads campaign_enrollments where status = 'active'
   - For each enrollment: check campaign_steps where delay has elapsed + not yet completed
   - Fire via Resend: sendEmail() with step template
   - Write campaign_step_completions row
   - Respect RESEND_SAFE_RECIPIENT lock until explicitly removed
2. Auto-enrollment trigger: database trigger on interactions.insert
   - Condition: type = 'meeting' AND contact has no active campaign enrollment
   - Action: enroll in "Post-Meeting Follow-Up" campaign (Touch 1-4 lighter sequence)
3. "New Agent Onboard" campaign template (full 7-touch): manual enrollment button on contact detail
4. Today View bucket 5: surface "Review Touch 3 email for [agent]" for Tier A/B approvals

**What you can use after:** Come back from BNI. Log the meeting. Touch 2 is
already scheduled for 24 hours from now without any additional action.

**Success check:** Create test interaction type='meeting' for a contact. Verify
enrollment row appears in campaign_enrollments. Verify step 1 fires within
the executor's next run cycle.

---

### Session 6 -- Loyalty Loop (~2.5 hours)

**Goal:** Every closing manages its own relationship work.

Tasks:
1. `deals.loyalty_layer` column (integer 0-3) + Supabase migration
2. Database trigger: deals.stage changes to 'in_escrow'
   - Writes signals.insert: type = 'loyalty_layer_due', layer = 1
   - Campaign executor picks it up: fires Layer 1 email ("Everything is on track")
3. Daily signal scan addition: deals.actual_close_date = current_date
   - Writes signals.insert: type = 'loyalty_layer_due', layer = 2
   - Today View bucket 2 (orange): "Closing day -- prepare gift + note for [agent] at [address]"
4. Daily signal scan addition: deals.actual_close_date + 30 days = current_date
   - Writes signals.insert: type = 'referral_window', layer = 3
   - Campaign executor: fires Layer 3 email ("How did your buyer settle in?")
5. Update deals.loyalty_layer on each signal resolution

**What you can use after:** Open a deal, flip stage to 'in_escrow', watch the
pre-close email queue. The 30-day referral ask becomes a system guarantee.

**Success check:** Set a test deal to 'in_escrow'. Verify Layer 1 signal
appears. Verify Layer 1 email is queued by campaign executor.

---

### Session 7 -- Adviser Strategy Wired (~2 hours)

**Goal:** Cost-efficient AI routing. Simple tasks go to Haiku, complex ones escalate to Opus.

Tasks:
1. Wire `contactClassification` feature key to createAdvisedCompletion()
   - Used when new contacts are created (classify tier suggestion based on brokerage, interactions)
2. Build and deploy morning briefing edge function using createAdvisedCompletion() (featureKey: morningBriefing)
   - Haiku for standard "here are your top 5 actions" output
   - Opus escalates when anomaly detected (unusual going_cold pattern, high-value deal at risk)
   - Cache result in Supabase with 1-hour TTL
3. Update morning-briefing skill to pull from edge function cached output instead of calling Claude fresh each time

**What you can use after:** Morning briefing is faster and cheaper. Routing
infrastructure is proven and ready for Phase 4 email draft generation.

**Success check:** Run morning briefing skill. Verify it pulls from Supabase
cache instead of making a fresh Claude API call.

---

### Session 8 -- Digital Aesthetic v2 Full Polish (~2.5 hours)

**Goal:** The CRM looks and feels like a premium product.

Tasks: Execute the 12-task plan at
`docs/superpowers/plans/2026-04-06-digital-aesthetic-v2-polish.md`

Key items:
- Workspace tier (contacts, tasks, follow-ups, campaigns, tickets, actions, analytics, opportunities)
  -- clean depth: no glass/mesh/noise. Surface-raised cards, border-border borders, hover only motion.
- Typography enforcement: Syne for page titles, Inter for body/cards/buttons, Space Mono for ALL numbers
- Headshot gradient masks: contact detail page + any card showing a face (remove any circle crops)
- Motion budget: workspace = hover/transition only, no keyframe animations on page content
- Today View and intake are already at the right aesthetic from Sessions 3 and prior work

**What you can use after:** The tool feels premium. Consistent with the design
system across every page.

**Success check:** Visual pass on every /app route. No Playfair on screen. No
numbers rendered in Inter. No circle headshot crops outside of email templates.

---

### Session 9 -- Dashboard Rebuild as Bento Command Center (~3.5 hours)

**Goal:** Login and know your entire business state in 10 seconds.

Layout (CSS grid-template-areas, static bento):
- Hero 2x2: Today View summary -- total actions, top priority, quick-action CTA
- Medium 2x1 (left): Relationship Health Leaders (top 5 by computed_health_score)
- Medium 2x1 (right): Pipeline Funnel (opportunities by stage, dollar volume)
- Compact 1x1 x3: KPI cards -- Touch Consistency (Tier A avg days between interactions),
  Campaign Completion Rate, Closings This Month
- Tall 1x2: Live Activity Feed (interactions realtime via Supabase Realtime + TanStack Query invalidation)

Stack (all locked per dashboard.md):
- Charts: shadcn/ui Charts (Recharts v3). No Tremor, no Nivo.
- Tables: TanStack Table v8 via shadcn Data Table
- Data: TanStack Query v5, staleTime per type (KPIs 60s, tasks 30s + Realtime invalidation)
- Command palette: cmdk via shadcn Command for Cmd+K

**What you can use after:** The dashboard replaces the /actions page as the
daily start point. All signal data, pipeline health, and KPIs visible at a glance.

**Success check:** Dashboard loads under 1s cold (SSR prefetch via HydrationBoundary).
Activity feed updates in real time when a test interaction is inserted.

---

### Sessions 10+ -- Revenue Automation Phases 4-6

**Phase 4 -- Personalization + Intelligence**
- Wire emailGeneration to createAdvisedCompletion(): Claude drafts Tier A/B emails
- Today View bucket 5: "Review draft email for [agent]" -- approve or edit, then send
- going_cold signal enhanced: Claude generates re-engagement angle based on last interaction content
- Tier A contacts: each touch is individually drafted. Tier B: template + dynamic fields.

**Phase 5 -- Co-Marketing Engine**
- Christine/Stephanie scoped campaign templates (lender separation rules from STRATEGY-CONTEXT.md enforced in campaign enrollment logic)
- Event-to-campaign pipeline: BNI / broker open / class logged as event --> auto-enroll all attendees
- Class registration intake page (separate from agent intake)

**Phase 6 -- Metrics + Optimization**
- Nightly metrics edge function: computes touch consistency, campaign completion rate, loyalty layer completion
- Analytics widget upgrade: revenue metrics from revenue-automation-engine.md formulas
- Morning briefing performance section: "Your Tier A touch rate this week was X vs. 7-day target"
- A/B testing infrastructure for campaign templates (open rate comparison)

---

## Key Constraints (Do Not Relitigate)

- **RESEND_SAFE_RECIPIENT lock stays** until Alex explicitly removes it. No campaign sends to real contacts until he says go.
- **No drag-and-drop dashboard layout.** Bento CSS grid only.
- **No new tables named `agents`.** Always extend `contacts`.
- **Adviser beta access pending.** Until enabled, createAdvisedCompletion() falls back to executor-only. This is fine -- the fallback works.
- **Voice memo parked** until OPENAI_API_KEY is available. Inbox table is ready.
- **Phone stays manual.** No Twilio. Text touches surface in Today View as action items only.

---

## Open Items (Required Before Session 1)

None -- Session 1 closes all pre-flight blockers as its primary deliverable.

---

## Files of Record

| File | Purpose |
|---|---|
| `~/crm/docs/revenue-automation-engine.md` | Business logic reference for all campaign/lifecycle features |
| `~/.claude/rules/dashboard.md` | Stack lock and layout contract for all UI work |
| `~/.claude/rules/digital-aesthetic.md` | Visual rules for all screen surfaces |
| `~/crm/docs/superpowers/plans/2026-04-07-spine-phase1.md` | Spine Phase 1 plan (Tasks 1-25) |
| `~/crm/docs/superpowers/plans/2026-04-06-digital-aesthetic-v2-polish.md` | 12-task polish plan for Session 8 |
| `~/STRATEGY-CONTEXT.md` | Lender separation rules, co-marketing constraints |
