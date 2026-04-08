# The Spine + Today Command -- Design Spec

**Status:** Draft (brainstorming complete, awaiting user review before writing-plans)
**Date:** 2026-04-07
**Owner:** Alex Hollien
**Scope:** Unified management spine + top-of-mind cycle engine + always-on command surface for GAT-BOS
**Target repo:** `~/crm/` (Phase 1), `~/.claude/skills/` (Phase 2), `~/crm/` (Phase 3+)

---

## 1. Vision and Success Criteria

### Working name
- **Technical name:** The Spine (the data + logic layer)
- **UI name:** Today Command (the screen Alex opens every morning)

### One-paragraph vision
Today Command is the single screen Alex opens every morning that answers three questions in under ten seconds: **who do I call today, what did I commit to, and what is the cycle engine surfacing.** It is the visible face of a shared data spine that unifies contacts, commitments, focus, and top-of-mind cycle state. Every other input channel (Claude Code conversations, voice brain-dumps, EOD briefings, mobile quick-capture, scheduled triggers) is a writer into that spine. The Today View is the only required reader; everything else is optional.

### Success criteria
1. Alex opens `/dashboard/today` every weekday morning. Replaces the current morning-briefing text output as the primary anchor.
2. "Who to call today" is accurate within 80%. If the system says call 5 people, 4 of them should feel right.
3. "What I committed to" captures at least 90% of promises made during the week, measured vs. EOD recall.
4. Cycle engine catches stale contacts within 2 days of going cold, not 2 weeks.
5. Capture friction is under 10 seconds for a micro-entry from phone.
6. After 30 days, the learning loop has tuned at least 3 per-contact cadence values without Alex touching them.

### What Today Command is NOT
- Not a replacement for the CRM contact list. Records still live in `contacts`.
- Not a task manager. Tasks are a *view* of commitments + focus, not a new silo.
- Not a chat interface. Claude Code remains the chat surface.
- Not a notification system. Pull-only, never push.

---

## 2. The Spine Data Model

Supabase tables. Reuses existing `contacts`, `interactions`, `opportunities`, `tasks`. Adds five new tables. All follow project conventions: `user_id` with `auth.uid()` default, `deleted_at` for soft delete per Standing Rule 3, timestamps, RLS enabled.

### Existing tables referenced (not modified in Phase 1)
- `contacts` -- source of truth for people (39 columns, includes tier, temperature, stage, farm_area)
- `interactions` -- source of truth for "when did we last talk"
- `opportunities` -- transactional signals (closing_date, stage, sale_price, escrow_number)
- `tasks` -- generic to-dos (NOT replaced)
- `agent_relationship_health` (materialized view, planned per dashboard.md) -- relationship scoring

### New table: `commitments`
Specific promises Alex made to specific contacts.

```sql
create table commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  contact_id uuid references contacts(id) on delete set null,
  opportunity_id uuid references opportunities(id) on delete set null,
  title text not null,
  description text,
  kind text check (kind in ('flyer','email','intro','data','call','meeting','gift','other')),
  promised_at timestamptz not null default now(),
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','in_progress','delivered','dropped','blocked')),
  source text check (source in ('meeting','claude_conversation','eod','voice','micro_capture','manual')),
  source_ref text,
  delivered_at timestamptz,
  delivered_via text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index on commitments(user_id, status) where deleted_at is null;
create index on commitments(user_id, due_at) where deleted_at is null;
create index on commitments(contact_id) where deleted_at is null;
```

Distinct from `tasks`: tasks are generic action items, commitments are promises with a recipient.

### New table: `focus_queue`
This week's rotation, the "who gets my direct attention."

```sql
create table focus_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  contact_id uuid not null references contacts(id) on delete cascade,
  week_of date not null,
  rank smallint,
  reason text check (reason in ('signal','cadence','manual','commitment')),
  reason_detail text,
  suggested_action text,
  status text not null default 'pending' check (status in ('pending','touched','skipped','deferred')),
  touched_at timestamptz,
  touched_via text,
  outcome text check (outcome in ('warm','cold','delivered','no_answer','left_message')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  unique(user_id, contact_id, week_of)
);
create index on focus_queue(user_id, week_of, status) where deleted_at is null;
```

Stored (not computed) so manual overrides persist and historical queues feed the learning loop.

### New table: `cycle_state`
Per-contact cadence config and running state. 1:1 with `contacts`, lazy-created only for contacts in active rotation.

```sql
create table cycle_state (
  contact_id uuid primary key references contacts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id),
  cadence_days integer,  -- null = use tier default
  tier_override text,
  paused_until date,
  last_touched_at timestamptz,
  next_due_at timestamptz,
  current_streak_days integer default 0,
  status text default 'active' check (status in ('active','paused','dormant','lost')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on cycle_state(user_id, next_due_at) where status = 'active';
```

**Tier defaults:** Tier 1 = 7 days, Tier 2 = 14 days, Tier 3 = 30 days.

**Trigger:** On `interactions` insert, update `cycle_state.last_touched_at` and recompute `next_due_at = last_touched_at + interval (cadence_days || tier_default) days`.

### New table: `signals`
Detected events that warrant a touchpoint.

```sql
create table signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  contact_id uuid references contacts(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  kind text not null check (kind in ('stale','closing_soon','birthday','listing_dom','market_shift','custom')),
  severity text default 'normal' check (severity in ('low','normal','high','urgent')),
  detected_at timestamptz default now(),
  window_start date,
  window_end date,
  title text not null,
  detail text,
  suggested_action text,
  status text default 'active' check (status in ('active','acted_on','dismissed','expired')),
  acted_on_at timestamptz,
  created_at timestamptz default now(),
  deleted_at timestamptz
);
create index on signals(user_id, status, severity) where deleted_at is null;
create index on signals(contact_id) where deleted_at is null;
```

Signals auto-expire when `window_end < now` via nightly sweep job.

### New table: `spine_inbox`
Raw captures waiting to be reconciled. Everything lands here first before parsing.

```sql
create table spine_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  raw_text text not null,
  source text not null check (source in ('claude_session','voice','micro','eod','morning','manual','dashboard_bar')),
  source_ref text,
  captured_at timestamptz default now(),
  parsed boolean default false,
  parsed_at timestamptz,
  parsed_commitment_ids uuid[],
  parsed_signal_ids uuid[],
  parsed_focus_ids uuid[],
  parsed_contact_refs uuid[],
  parse_notes text,
  deleted_at timestamptz
);
create index on spine_inbox(user_id, parsed, captured_at);
```

### The hot-path query: `GET /api/spine/today`
One server query returns all 7 card payloads in one trip:
- Today's focus (focus_queue rows, this week, status=pending, ordered by rank)
- Overdue commitments (commitments where due_at < now AND status=open)
- Active high-severity signals (status=active AND severity in (high, urgent) AND window_end > now)
- Coming due (cycle_state where next_due_at < now + 48h AND status=active)
- This week rotation summary (count by status)
- Recent captures (last 5 spine_inbox rows with parsed status)
- Content calendar (next 2 scheduled content outputs from existing pipeline sources)

Cached with TanStack Query, 30s staleTime. Supabase Realtime invalidates on any spine table write.

### Deviations from existing schema
- `cycle_state.last_touched_at` denormalizes from `interactions`. Updated by trigger. Alternative considered: compute on read. Chose trigger because Today Command needs to be fast.
- `agent_relationship_health` (materialized view) and `cycle_state` have overlap. Decision: health view is the relationship *scoring* engine. `cycle_state` is the cycle/cadence *config + fast-read denorm*. They reference each other but do not duplicate logic.
- No new enum types. All enums as text columns with CHECK constraints. Matches CRM pattern.

---

## 3. The Cycle Engine

Four interlocking layers that produce the Today Command payload.

### Layer 1: Cadence (the "when" math)
- Tier defaults: Tier 1 = 7d, Tier 2 = 14d, Tier 3 = 30d (from client-universe.md).
- Per-contact override via `cycle_state.cadence_days`.
- Trigger on `interactions` insert updates `last_touched_at` and recomputes `next_due_at`.
- When `next_due_at < now + 48h`, contact is "due soon."
- When `next_due_at < now`, contact is "overdue" and auto-generates a `stale` signal.

### Layer 2: Signals (the "why now" detector)
Daily 7am Supabase cron writes to `signals`:
- `stale` -- cycle_state.next_due_at < now
- `closing_soon` -- opportunities.closing_date within 7 days
- `listing_dom` -- opportunity hitting DOM 30/60/90 thresholds
- `birthday` -- contact birthday within 7 days (if stored in contacts extended fields)
- `market_shift` -- from research-scout (existing nightly trigger, upgraded to POST to /api/spine/signals)
- `custom` -- written by Claude Code `spine` skill during conversations

Severity gates display priority: urgent > high > normal > low.
Signals auto-expire when `window_end < now`.

### Layer 3: Rotation (the "this week's focus" curator)
Monday 6am Supabase cron runs "weekly rotation build":
1. Read active signals, overdue commitments, cycle_state due this week, Alex's manual adds from previous week.
2. Score each candidate. Priority order: urgent signals > overdue commitments' contacts > high signals > due cadence > manual adds.
3. Write up to 10 `focus_queue` rows for the current `week_of`.
4. Remaining candidates roll to next week.

Alex can add/remove manually during the week via Today Command quick actions.

### Layer 4: Content (the "passive baseline" awareness)
- Weekly Edge (Wed), Monthly Toolkit, Closing Brief, Partner Spotlight (absorbed into Weekly Edge).
- NOT scheduled by cycle engine. These run on their own.
- Engine reads the publishing calendar and surfaces "next content going out" as situational awareness on Today Command.
- Keeps top-of-mind cycle alive even on days Alex has zero individual touchpoints.

### Quick actions on Today Command focus cards
Single click, 44px touch targets per accessibility floor.
- **Touched** -- marks focus_queue.status=touched, creates `interactions` row, trigger updates cycle_state
- **Defer** -- moves to tomorrow
- **Skip** -- drops from this week with required reason
- **Note** -- inline text input, writes to interactions

---

## 4. Today Command UI (Phase 1 deliverable)

Route: `/dashboard/today` in the CRM at `~/crm/`.
Tier: **workspace** per digital-aesthetic.md (clean depth, no noise/mesh/glass).
Stack: Next.js 14 App Router, TanStack Query v5, Supabase Realtime, shadcn/ui, dnd-kit (future, not Phase 1), cmdk for Cmd+K.

### Bento grid layout (CSS Grid with grid-template-areas per dashboard.md lock)

Desktop (1200px+):
```
┌─────────────────────────────┬──────────────┐
│                             │  COMING DUE  │
│     TODAY'S FOCUS           │  (1x1)       │
│     (hero 2x2)              ├──────────────┤
│     3-5 people for today    │  THIS WEEK   │
│                             │  ROTATION    │
│                             │  (1x1)       │
├─────────────────┬───────────┴──────────────┤
│ OVERDUE         │ HIGH SIGNALS             │
│ COMMITMENTS     │ (2x1)                    │
│ (2x1)           │                          │
├─────────────────┴──────────────┬───────────┤
│ RECENT CAPTURES                │ CONTENT   │
│ (tall 1x2)                     │ CALENDAR  │
│                                │ (1x1)     │
└────────────────────────────────┴───────────┘
```

Tablet: 2 columns, priority order. Today's Focus stays full-width hero.
Mobile: Single column, Today's Focus first, Overdue Commitments second, High Signals third, everything else collapses.

### Card contents

**Today's Focus (hero 2x2)** -- Subset of this week's `focus_queue` filtered by today's urgency. 3-5 rows. Each row:
- Headshot (gradient mask per digital-aesthetic.md, no hard circle crop)
- Name (Inter 600)
- Reason one-liner (Inter 400)
- Suggested action
- Quick-touch buttons: Touched / Defer / Skip / Note

**Coming Due (compact 1x1)** -- Count + 2-3 preview names of cadence entries hitting next_due_at in next 48h. Click to expand full list.

**This Week Rotation (compact 1x1)** -- Count of remaining focus_queue items this week + small status preview. Click to expand the full 10-row queue.

**Overdue Commitments (medium 2x1)** -- List of commitments where due_at < now AND status=open, ordered by how overdue. Quick actions: mark delivered, defer, drop.

**High Signals (medium 2x1)** -- Active signals where severity in (high, urgent) AND not yet acted on. Quick actions: mark acted, dismiss, convert to commitment.

**Recent Captures (tall 1x2)** -- Last 5 spine_inbox entries with parsed status (parsed / pending / failed). Click to open and reconcile.

**Content Calendar (compact 1x1)** -- Next 2 scheduled content outputs (Weekly Edge Wed, Monthly Toolkit 15th). Awareness only, not actionable from here.

### Always-on Claude bar
Single-line command input fixed at the bottom of Today Command. Type anything:
> "met Sarah warm, needs Optima flyer by Friday"

Fires POST to `/api/spine/capture`, writes to `spine_inbox`, the background parser picks it up, Recent Captures card updates via Supabase Realtime. Zero friction. This is the on-screen always-on capture channel.

### Accessibility floor (per dashboard.md Section 7)
- 44x44 px touch targets minimum (24x24 WCAG 2.2 AA)
- aria-label on every card container
- aria-live="polite" on Today's Focus (auto-updates)
- Roving tabindex within the bento grid
- Skip links: "Skip to Today's Focus," "Skip to command bar"
- prefers-reduced-motion honored
- Every count/number uses Space Mono font per digital-aesthetic.md

### Visual tier compliance
Workspace tier per digital-aesthetic.md:
- Clean dark surfaces via CSS variables (--surface-base, --surface-raised)
- border-border (1px solid ~16% lightness)
- hover:border-white/[0.12]
- NO noise texture, NO gradient mesh, NO glass blur, NO glow shadows
- Typography strict roles: Syne for page title only, Inter for card titles and body, Space Mono for all numbers/dates
- GAT Red (#b31a35 print mapped to #e63550 screen accent) for primary CTAs only

---

## 5. API Surface

All routes in `~/crm/app/api/spine/*`. Next.js 14 app router. Excluded from auth middleware redirects per CLAUDE.md architecture rule. Browser routes use Supabase session auth. Internal routes (Claude Code, crons) use `INTERNAL_API_TOKEN` bearer guard (already wired in phase 2.1).

```
POST   /api/spine/capture          raw text -> spine_inbox
GET    /api/spine/today            Today Command payload (7-card bundle, hot path)

GET    /api/spine/focus            list focus_queue by week
POST   /api/spine/focus            manually add/remove for current week
PATCH  /api/spine/focus/:id        touched / deferred / skipped + outcome

GET    /api/spine/commitments      list (filterable by status/contact/due)
POST   /api/spine/commitments      create
PATCH  /api/spine/commitments/:id  update status / delivered_via / notes

GET    /api/spine/signals          list active signals
POST   /api/spine/signals          manual or external create
PATCH  /api/spine/signals/:id      acted_on / dismissed

GET    /api/spine/cycle/:contactId read cycle_state
PATCH  /api/spine/cycle/:contactId tune cadence / pause / notes

GET    /api/spine/inbox            list (with parsed status)
POST   /api/spine/parse/:inboxId   trigger parser (usually automatic)
```

Every POST and PATCH writes `updated_at = now()` and respects Standing Rule 3 (soft delete only, `deleted_at` timestamp, never DELETE).

---

## 6. The Parser

Raw text lands in `spine_inbox`. A parser turns it into structured rows.

### Two trigger modes

**Inline (Claude Code origin):** When the `spine` skill writes to inbox from a Claude session, Claude already has the context. It writes parsed commitment/signal rows directly in the same call and marks the inbox entry parsed.

**Background (mobile, dashboard bar, voice origin):** A cron job every 5 minutes reads unparsed inbox rows, sends each one plus a recent contacts index to Claude API server-side (via `INTERNAL_API_TOKEN`), receives structured JSON, writes to tables, marks parsed. Failed parses get a `parse_notes` value and stay for manual review.

### What the parser extracts
- **Contacts mentioned** (fuzzy match against contacts table by first name, email, phone, brokerage)
- **Commitments made** (kind + recipient + due_at)
- **Signals observed** (stale, closing_soon, etc.)
- **Focus intent** ("make sure I call X this week" -> focus_queue add)

### Parser prompt structure
System prompt contains:
- Schema of commitments, signals, focus_queue tables
- Client-universe tier definitions
- Recent contacts index (last 30 days of active contacts, first_name + last_name + brokerage)
- Standing rules affecting writes (no hard deletes, lender separation, Christine McConnell scope)
- Few-shot examples from `~/crm/supabase/spine-parser-examples.jsonl` (grown by the learning loop)

User message is the raw_text from the inbox row.

Response is JSON conforming to a Zod schema validated server-side before any DB writes.

---

## 7. Capture Channels

| Channel | Lives at | Writes via | Parser mode |
|---|---|---|---|
| Today Command Claude bar | /dashboard/today bottom | POST /api/spine/capture (session auth) | Background cron |
| Mobile quick-capture (Phase 3) | /capture route | POST /api/spine/capture (session auth) | Background cron |
| Claude Code `spine` skill (Phase 2) | ~/.claude/skills/spine/ | Direct SQL via bearer token | Inline |
| Voice brain-dump | end-of-day-briefing skill (exists) | Skill writes parsed output to /api/spine/* | Inline |
| Morning briefing | morning-briefing skill (exists) | Reads /api/spine/today, writes morning context | Inline |
| Weekly rotation build | Supabase cron, Mon 6am MST | Direct SQL in edge function | N/A |
| Signal scan | Supabase cron, daily 7am MST | Direct SQL in edge function | N/A |
| research-scout external signals | existing trigger, 11pm MST | POST /api/spine/signals (bearer) | N/A |

---

## 8. Phase Roadmap

Reordered per user direction: **CRM side ships first as a complete deliverable.** Ambient Claude Code skill and mobile capture come after, writing back to the same Supabase spine.

### Phase 1 -- Spine + Today Command (CRM, ships together)
**Target repo:** `~/crm/`

- Supabase migrations: 5 new tables, RLS policies, triggers (interactions -> cycle_state.last_touched_at denorm), indexes
- `/api/spine/*` routes with session + bearer auth
- Parser server action + cron job (every 5 min)
- Cycle engine crons: Mon 6am weekly rotation build, daily 7am signal scan
- `/dashboard/today` page with 7-card bento layout
- TanStack Query + Supabase Realtime wiring
- Always-on Claude bar component at bottom
- Seed job: create `cycle_state` row for every Tier 1/2 contact with tier-default cadence
- Workspace-tier visual compliance per digital-aesthetic.md
- Accessibility floor per dashboard.md Section 7

**Ship criteria:** Alex opens `/dashboard/today` Monday morning, uses it for a full week, capture bar works, at least one real contact auto-surfaced by the cycle engine.

### Phase 2 -- Ambient Claude Code Layer
**Target repo:** `~/.claude/skills/`

- New `spine` skill at `~/.claude/skills/spine/SKILL.md`
- Reads `/api/spine/today` at session start so every Claude Code conversation knows the current state
- Writes commitments, signals, captures during conversations via bearer token
- `morning-briefing` and `end-of-day-briefing` skills upgraded to read/write spine (not just memory files)
- Stop hook appends session context as a spine_inbox entry

**Ship criteria:** Alex says "I promised Sarah a flyer by Friday" in any Claude session and it shows up in Today Command within 5 minutes.

### Phase 3 -- Mobile Capture Layer
**Target repo:** `~/crm/`

- `/capture` route in CRM (mobile-first, no chrome, no nav)
- Quick-tap buttons: "met [contact] warm", "called [contact] VM", "promised [contact] [kind]"
- Web Speech API voice -> text -> POST /api/spine/capture
- 44px touch targets, prefers-reduced-motion honored
- PWA manifest for install-to-homescreen

**Ship criteria:** Alex captures 3+ field interactions per day from his phone for a week.

### Phase 4 -- Learning Loop (self-improvement)
**Target repo:** `~/crm/` (cron jobs) + `~/.claude/skills/` (weekly-audit upgrade)

- Weekly audit reviews focus_queue outcomes: what was surfaced vs. what got touched, with what result
- Per-contact cadence auto-tuning
- Signal sensitivity auto-tuning
- Writes learnings to cycle_state.notes and to ~/.claude/memory/project_spine.md
- Parser correction feedback to `spine-parser-examples.jsonl`

**Ship criteria:** After 30 days of use, at least 3 contacts have auto-tuned cadence without manual intervention.

### Phase 5 -- Content Calendar Integration
**Target repo:** `~/crm/` + `~/.claude/skills/weekly-production/`

- Reads Weekly Edge / Monthly Toolkit / Closing Brief schedule from existing sources
- Content Calendar card on Today Command populates from live schedule
- "Tag this contact for next Weekly Edge" quick action on focus cards
- Tagged contacts feed into Weekly Edge pre-curation pass

**Ship criteria:** Alex can earmark an agent on Today Command and see them surface in the next Weekly Edge pre-curation output.

### Dependencies
```
Phase 1 (CRM spine + Today Command)    --> blocks everything
   +-- Phase 2 (Claude Code ambient)
   +-- Phase 3 (Mobile capture)
   +-- Phase 4 (Learning loop, needs Phase 1 + 3 historical data)
   +-- Phase 5 (Content integration)
```

Phase 1 is the one big lift. Everything after is incremental on top.

---

## 9. The Learning Loop

Six signals the system learns from.

| Signal | What it tunes | Where it writes |
|---|---|---|
| Cadence accuracy (touched-before-due 3x -> shrink, skipped 3x -> grow) | cycle_state.cadence_days | Per-contact, auto |
| Signal precision (dismissed 3x -> downgrade or disable) | cycle_state.notes + signal config | Per-contact, auto |
| Focus queue hit rate (skipped reasons get downweighted) | rotation priority weights | System-wide, auto |
| Outcome patterns (warm/cold by time/day/channel) | cycle_state.notes | Per-contact, suggested |
| Commitment velocity (avg days to deliver by kind) | default due_at offsets | System-wide, auto |
| Parser corrections (manual corrections captured as examples) | spine-parser-examples.jsonl | Parser prompt few-shot |

### When learning happens
- **Weekly audit** (Friday, existing `weekly-audit` skill upgraded): reviews the week's focus_queue outcomes and writes a tuning report. Auto-applies low-risk tunings (cadence plus or minus 2 days). Flags high-risk tunings for Alex approval.
- **Nightly aggregator** (new cron, 11:30pm MST): rolls up stats, flags tuning candidates for the weekly audit.
- **Manual trigger:** Alex says "learn from this week" in any Claude Code session and the `spine` skill runs the audit on demand.

### Where learnings live
- **Per-contact tuning** -> `cycle_state.cadence_days` (machine-readable) + `cycle_state.notes` (human-readable)
- **System-wide patterns** -> `~/.claude/memory/project_spine.md` (so Claude Code sessions pick up what's been learned)
- **Parser corrections** -> `~/crm/supabase/spine-parser-examples.jsonl` (fed into parser prompt as few-shot examples)

---

## 10. Non-Goals (explicitly NOT building)

- **Not a relationship scoring AI** -- `agent_relationship_health` already handles this
- **Not a CRM replacement** -- this is a lens on top of the CRM, not a new silo
- **Not a task manager** -- tasks stay in `tasks` table, commitments are the subset with recipients
- **Not a notification / push system** -- pull-only, the system does not nag Alex
- **Not multi-user** -- single user, `user_id` scoped with RLS
- **Not calendar sync** -- Google Calendar integration lives outside this spec
- **Not email/text automation** -- suggests actions, Alex executes them per Standing Rule 5
- **Not an AI autopilot** -- no auto-send, no auto-commit, every external action needs Alex approval

---

## 11. Open Questions (need Alex decision before Phase 1 kickoff)

1. **Seeding cycle_state.** Auto-create for all Tier 1+2 contacts at once, only Tier 1, or let Alex opt in per contact?
   - **Recommendation:** auto-create for Tier 1+2, skip Tier 3 until tapped in.

2. **Dormant handling.** When contact.stage = dormant, drop from cycles entirely, shift to 90-day cadence, or pause with manual re-activation?
   - **Recommendation:** pause with manual re-activation (matches Standing Rule 3 spirit of never losing data).

3. **Quarterly event drip interaction.** When a quarterly event drip is active, should invited contacts get a temporary `paused_until` on normal cycle to prevent double-touching?
   - **Recommendation:** yes, with auto-resume after the event.

4. **Auto-apply vs suggest for learning loop.** Auto-apply low-risk tunings (cadence plus or minus 2 days) or always suggest?
   - **Recommendation:** auto-apply small tunings, suggest large ones, log everything.

5. **Mobile: PWA or native?** Phase 3 `/capture` route.
   - **Recommendation:** PWA. Cheaper, fast enough, install-to-homescreen gives near-native feel.

6. **Vacation snooze.** Global "I'm out this week" button that pauses everything and rebuilds focus queue on return?
   - **Recommendation:** yes, Phase 4.

7. **Commitment attachments.** Link commitments to files (Canva URL, flyer path) or stay text-only?
   - **Recommendation:** text-only in Phase 1. Add `attachments jsonb` column in Phase 5 if needed.

8. **Christine McConnell rules in the spine.** Should the system warn if Alex is about to add a commitment involving Christine + a non-Julie context (per Standing Rule 9)?
   - **Recommendation:** yes, parser validates lender separation rules and flags violations to `parse_notes` for review.

---

## 12. Alignment with Existing System

### Reuses
- `contacts`, `interactions`, `opportunities`, `tasks` tables
- `agent_relationship_health` materialized view (reference, not duplicated)
- Existing `INTERNAL_API_TOKEN` bearer guard from phase 2.1
- Existing `morning-briefing`, `end-of-day-briefing`, `weekly-audit`, `research-scout` skills
- Existing `/api/*` auth middleware exclusion per CLAUDE.md
- Existing digital-aesthetic.md workspace tier
- Existing dashboard.md architecture contract (bento grid, stack lock, accessibility floor)
- Existing memory system (recent/project/long-term) for learning loop persistence

### Extends
- CRM dashboard (Today Command becomes the primary dashboard page or a sibling to the planned rebuild)
- Skill system (new `spine` skill in Phase 2)
- Supabase schema (5 new tables, all additive, no breaking changes)

### Does not touch
- Print design skills
- Email design skills
- Canva handoff
- Listing pipeline
- Agent creative brief flow

---

## 13. Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-07 | Hybrid architecture with CRM-side first | Visual surface is the anchor; ambient and mobile layers feed it |
| 2026-04-07 | Reuse `contacts` and `interactions`, do not duplicate | Source of truth lives in CRM |
| 2026-04-07 | `commitments` distinct from `tasks` | Tasks are generic, commitments have recipients |
| 2026-04-07 | `focus_queue` stored, not computed | Manual overrides must persist, history feeds learning |
| 2026-04-07 | Parser has inline + background modes | Claude sessions parse inline, other channels queue for batch |
| 2026-04-07 | Tier defaults 7/14/30 days | Matches client-universe.md tier definitions |
| 2026-04-07 | Workspace tier (not showcase) for Today Command | Utility surface, not a landing page |
| 2026-04-07 | PWA for mobile, not native | Cheaper, sufficient for capture use case |

---

## 14. Next Step

After user review and approval of this spec, invoke the superpowers:writing-plans skill to produce a detailed Phase 1 implementation plan at `~/crm/docs/superpowers/plans/2026-04-07-spine-phase1-ship.md`.

Phase 1 plan should cover:
- SQL migration files (new tables + triggers + indexes + RLS policies)
- `/api/spine/*` route files
- Parser server action + cron wiring
- Cycle engine cron jobs (Mon rotation build, daily signal scan)
- `/dashboard/today` page + 7 card components
- TanStack Query + Supabase Realtime hooks
- Always-on Claude bar component
- Seed script for existing contacts -> cycle_state
- Verification steps per superpowers:verification-before-completion
