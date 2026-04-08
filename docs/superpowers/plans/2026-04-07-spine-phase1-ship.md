# Spine + Today Command -- Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Spine backend (5 tables, 10 API routes, parser, cycle engine crons, seed job) and the Today Command UI (`/dashboard/today` with 7-card bento, always-on Claude bar, realtime) together as a single working deliverable.

**Architecture:** New Supabase tables (`commitments`, `focus_queue`, `cycle_state`, `signals`, `spine_inbox`) live alongside existing `contacts`/`interactions`/`opportunities`. A background parser turns raw captures into structured rows. Two cron jobs run the cycle engine (daily signal scan, Monday rotation build). `/api/spine/today` is the hot path that returns all 7 card payloads in one query. Today Command is a workspace-tier dashboard page that renders that payload and invalidates via Supabase Realtime.

**Tech Stack:** Next.js 14.2.35 App Router, TanStack Query v5, Supabase (Postgres + RLS + Edge Functions), Zod for validation, Anthropic SDK (for the parser), shadcn/ui components, Tailwind v3, cmdk, pnpm.

**Spec:** `docs/superpowers/specs/2026-04-07-spine-today-command-design.md`

**Pre-flight:**
- Before starting implementation, consider using `superpowers:using-git-worktrees` to create an isolated worktree at `~/crm-spine-phase1/`. This keeps the main `~/crm/` working tree clean while the plan executes.
- Confirm `.env.local` has `INTERNAL_API_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and add `ANTHROPIC_API_KEY` before Task 11.
- Confirm you're on a feature branch, not `main`. If unsure, stop and ask the user.
- All commits use the Claude Code co-author trailer per CLAUDE.md convention.

---

## File Structure (all paths relative to `~/crm/`)

### Create
- `supabase/migrations/20260407020000_spine_tables.sql` -- 5 new tables, RLS, indexes, trigger
- `supabase/migrations/20260407021000_spine_interactions_trigger.sql` -- denorm trigger
- `supabase/migrations/20260407030000_spine_seed_cycle_state.sql` -- one-time seed for Tier 1+2
- `supabase/functions/spine-signal-scan/index.ts` -- daily 7am edge function
- `supabase/functions/spine-rotation-build/index.ts` -- Monday 6am edge function
- `supabase/functions/spine-parser/index.ts` -- every 5min edge function
- `src/lib/spine/types.ts` -- shared TypeScript types + Zod schemas
- `src/lib/spine/queries.ts` -- server-side Supabase query helpers
- `src/lib/spine/parser.ts` -- Claude API parser logic
- `src/app/api/spine/today/route.ts`
- `src/app/api/spine/capture/route.ts`
- `src/app/api/spine/inbox/route.ts`
- `src/app/api/spine/parse/[inboxId]/route.ts`
- `src/app/api/spine/commitments/route.ts`
- `src/app/api/spine/commitments/[id]/route.ts`
- `src/app/api/spine/signals/route.ts`
- `src/app/api/spine/signals/[id]/route.ts`
- `src/app/api/spine/focus/route.ts`
- `src/app/api/spine/focus/[id]/route.ts`
- `src/app/api/spine/cycle/[contactId]/route.ts`
- `src/app/(app)/dashboard/today/page.tsx`
- `src/app/(app)/dashboard/today/query.ts` -- TanStack Query hooks
- `src/app/(app)/dashboard/today/realtime.tsx` -- realtime subscription provider
- `src/components/today/TodayFocusCard.tsx`
- `src/components/today/ComingDueCard.tsx`
- `src/components/today/WeekRotationCard.tsx`
- `src/components/today/OverdueCommitmentsCard.tsx`
- `src/components/today/HighSignalsCard.tsx`
- `src/components/today/RecentCapturesCard.tsx`
- `src/components/today/ContentCalendarCard.tsx`
- `src/components/today/CaptureBar.tsx`

### Modify
- `src/lib/types.ts` -- re-export spine types
- `package.json` -- add `@anthropic-ai/sdk` dependency

### Do NOT touch
- `contacts`, `interactions`, `opportunities`, `tasks` tables (source of truth, reference only)
- Existing middleware
- Existing auth flows
- Any skill file at `~/.claude/skills/`

---

## Milestones

- **Milestone A (after Task 14):** Backend complete. `GET /api/spine/today` returns a valid empty-state payload, cycle_state seeded for Tier 1+2, crons deployed. Halt for review before frontend.
- **Milestone B (after Task 25):** Phase 1 ship. `/dashboard/today` renders the payload, capture bar writes to inbox, parser processes it, UI updates via realtime.

---

## Schema Reality (added 2026-04-08 — addendum, supersedes any task-level schema assumptions below)

> **For all subagents implementing tasks below:** The plan was originally written against an assumed schema that does not exactly match production. This section is the authoritative reference for the four "DO NOT TOUCH" tables that the spine layer reads from. **When a task body below contradicts this section, this section wins.**

### `public.contacts` (106 rows, 1 soft-deleted as of 2026-04-08)

Columns the spine work cares about:

- `id` uuid PK
- `first_name`, `last_name` text NOT NULL
- `email`, `phone` text nullable
- `type` text NOT NULL, default `'realtor'`. CHECK in: `realtor, lender, builder, vendor, buyer, seller, past_client, warm_lead, referral_partner, sphere, other`
- `tier` text **nullable**, **CHECK in: `'A', 'B', 'C', 'P'` only — no numeric tiers, no `'tier1'` strings**
- `stage` text NOT NULL, default `'new'`. CHECK in: `new, warm, active_partner, advocate, dormant`
- `health_score` integer 0..100 (this is the dashboard "temperature")
- `rep_pulse` integer 1..10 nullable
- `last_touch_date` timestamptz nullable (manually maintained, separate from `cycle_state.last_touched_at` which the spine trigger maintains automatically)
- `next_action`, `next_action_date` (manual reminders, separate from `focus_queue`)
- `farm_area` text, `farm_zips` text[]
- `notes` text (added 2026-04-08 in commit `7ae7577`)
- `internal_note` text (long-standing, separate from `notes`)
- `headshot_url`, `brokerage_logo_url`, `agent_logo_url`, `brand_colors` jsonb, `palette`, `font_kit`
- `preferred_channel`, `referred_by`, `escrow_officer`
- `user_id` uuid NOT NULL default `auth.uid()`
- `created_at`, `updated_at`, `deleted_at` timestamptz

**Tier distribution as of 2026-04-08:** A=26, B=26, C=16, P=22, NULL=15. P most likely means "Prospect" -- confirm with Alex before treating differently from A/B/C.

### `public.interactions`

- `id` uuid PK
- `user_id` uuid NOT NULL
- `contact_id` uuid NOT NULL
- `type` `interaction_type` Postgres enum, NOT NULL. **Enum values: `call, text, email, meeting, broker_open, lunch, note`**
- `summary` text NOT NULL ← **NOT `note`**. Plan body's smoke test SQL uses `note`; that column does not exist.
- `occurred_at` timestamptz default `now()` (when the interaction happened)
- `created_at` timestamptz default `now()` (when the row was inserted; this is what the spine trigger reads as `last_touched_at`)
- `direction` text nullable, CHECK in `inbound, outbound`
- `duration_minutes` integer nullable
- **NO `deleted_at`**, **NO `updated_at`** (this is why the Task 2 smoke-test cleanup required a hard delete)

The spine trigger `interactions_update_cycle` (committed in `eef1132` as part of Task 2) fires AFTER INSERT and reads `new.contact_id`, `new.user_id`, `new.created_at`. It does not read `new.type` or `new.summary`.

### `public.opportunities`

- `id` uuid PK
- `contact_id` uuid NOT NULL
- `property_address` text NOT NULL
- `property_city`, `property_state` (default `'AZ'`), `property_zip`
- `sale_price` numeric nullable
- `stage` `opportunity_stage` Postgres enum, default `'prospect'`. **Enum values: `prospect, under_contract, in_escrow, closed, fell_through`**
- `escrow_number` text
- `opened_at`, `expected_close_date`, `closed_at` date
- `notes` text
- `user_id` uuid NOT NULL default `auth.uid()`
- `created_at`, `updated_at`, `deleted_at` timestamptz

The spine `signals.kind = 'closing_soon'` (Task 14) should detect rows where `stage IN ('under_contract', 'in_escrow')` and `expected_close_date` is within the upcoming window. The plan body does not enumerate stage names; this is the actual list.

### `public.tasks`

- `id` uuid PK
- `contact_id` uuid **nullable** (no FK enforcement)
- `title` text NOT NULL
- `description` text nullable
- `due_date` timestamptz nullable
- `priority` text default `'medium'`, CHECK in: `low, medium, high, urgent`
- `status` text default `'open'`, CHECK in: `open, done, snoozed, cancelled`
- `is_recurring` boolean default false, `recurrence_rule` text
- `completed_at`, `snoozed_until` timestamptz nullable
- `user_id` uuid NOT NULL default `auth.uid()`
- `created_at`, `updated_at`, `deleted_at` timestamptz

The spine plan does not currently read from `tasks` directly -- `commitments` is the spine's parallel concept. If a future task surfaces tasks on the dashboard alongside commitments, use the column shape above.

### Tier mapping for cycle cadence (used by Task 2 trigger and Tasks 14, 15, 16)

The plan body assumes numeric tiers; reality uses letter grades. The mapping committed in `eef1132` (Task 2):

| Plan tier value | Reality tier value | Cadence (days) |
|---|---|---|
| `'1'`, `'tier1'` | `'A'` | 7 |
| `'2'`, `'tier2'` | `'B'` | 14 |
| `'3'`, `'tier3'` | `'C'` | 30 |
| (none) | `'P'` | 30 (default branch) |
| (none) | NULL | 30 (default branch) |

**For Task 16 (seed cycle_state for Tier 1+2):** the seed query must target `tier IN ('A', 'B')`, NOT `tier IN ('1', '2')` or `tier IN ('tier1', 'tier2')`. P contacts may or may not qualify depending on Alex's intent -- confirm before seeding.

### Spec-to-reality column rename map (quick reference)

| Plan body says | Reality is | Tasks affected |
|---|---|---|
| `interactions.note` | `interactions.summary` | Tasks 2 (smoke test), 5, 12 |
| `contacts.tier IN ('1','2','3')` | `contacts.tier IN ('A','B','C','P')` | Tasks 2, 5, 14, 15, 16 |
| (assumed) `interactions.deleted_at` | does not exist on `interactions` | Task 2 cleanup, Tasks 5/12/14 |
| (assumed) `interactions.updated_at` | does not exist on `interactions` | Tasks 5/12 |

### Standing rule for all task dispatches below

Every controller-to-subagent prompt below must reference this Schema Reality section (or a tightened slice of it relevant to the task) in its context. Plan task bodies are NOT verbatim authoritative on schema details for the four DO NOT TOUCH tables -- this addendum is.

---

# PART A -- DATABASE LAYER

## Task 1: Create spine tables migration

**Files:**
- Create: `supabase/migrations/20260407020000_spine_tables.sql`

- [ ] **Step 1: Create the migration file with all 5 tables, RLS policies, indexes, and the interactions trigger**

```sql
-- supabase/migrations/20260407020000_spine_tables.sql
-- Phase 1 of the Spine + Today Command build.
-- Adds 5 new tables, RLS, indexes, and denorm trigger.
-- Idempotent: drops existing policies before recreate, uses IF NOT EXISTS on tables.

-- =========================================================
-- 1. commitments
-- =========================================================
create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  contact_id uuid references public.contacts(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  title text not null,
  description text,
  kind text check (kind in ('flyer','email','intro','data','call','meeting','gift','other')),
  promised_at timestamptz not null default now(),
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','in_progress','delivered','dropped','blocked')),
  source text check (source in ('meeting','claude_conversation','eod','voice','micro_capture','manual','dashboard_bar')),
  source_ref text,
  delivered_at timestamptz,
  delivered_via text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists commitments_user_status_idx
  on public.commitments(user_id, status) where deleted_at is null;
create index if not exists commitments_user_due_idx
  on public.commitments(user_id, due_at) where deleted_at is null;
create index if not exists commitments_contact_idx
  on public.commitments(contact_id) where deleted_at is null;

alter table public.commitments enable row level security;
drop policy if exists commitments_owner on public.commitments;
create policy commitments_owner on public.commitments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================
-- 2. focus_queue
-- =========================================================
create table if not exists public.focus_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  contact_id uuid not null references public.contacts(id) on delete cascade,
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
  constraint focus_queue_unique_per_week unique(user_id, contact_id, week_of)
);

create index if not exists focus_queue_user_week_status_idx
  on public.focus_queue(user_id, week_of, status) where deleted_at is null;

alter table public.focus_queue enable row level security;
drop policy if exists focus_queue_owner on public.focus_queue;
create policy focus_queue_owner on public.focus_queue
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================
-- 3. cycle_state
-- =========================================================
create table if not exists public.cycle_state (
  contact_id uuid primary key references public.contacts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id),
  cadence_days integer,
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

create index if not exists cycle_state_user_next_due_idx
  on public.cycle_state(user_id, next_due_at) where status = 'active';

alter table public.cycle_state enable row level security;
drop policy if exists cycle_state_owner on public.cycle_state;
create policy cycle_state_owner on public.cycle_state
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================
-- 4. signals
-- =========================================================
create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  contact_id uuid references public.contacts(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
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

create index if not exists signals_user_status_sev_idx
  on public.signals(user_id, status, severity) where deleted_at is null;
create index if not exists signals_contact_idx
  on public.signals(contact_id) where deleted_at is null;

alter table public.signals enable row level security;
drop policy if exists signals_owner on public.signals;
create policy signals_owner on public.signals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================
-- 5. spine_inbox
-- =========================================================
create table if not exists public.spine_inbox (
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

create index if not exists spine_inbox_user_parsed_captured_idx
  on public.spine_inbox(user_id, parsed, captured_at);

alter table public.spine_inbox enable row level security;
drop policy if exists spine_inbox_owner on public.spine_inbox;
create policy spine_inbox_owner on public.spine_inbox
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================
-- updated_at trigger (shared helper)
-- =========================================================
create or replace function public.spine_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists commitments_touch on public.commitments;
create trigger commitments_touch before update on public.commitments
  for each row execute function public.spine_touch_updated_at();

drop trigger if exists focus_queue_touch on public.focus_queue;
create trigger focus_queue_touch before update on public.focus_queue
  for each row execute function public.spine_touch_updated_at();

drop trigger if exists cycle_state_touch on public.cycle_state;
create trigger cycle_state_touch before update on public.cycle_state
  for each row execute function public.spine_touch_updated_at();
```

- [ ] **Step 2: Apply the migration to local Supabase**

Run:
```bash
cd ~/crm && pnpm dlx supabase db push --include-all
```

Expected: Output lists the new migration applied. No errors.

Fallback if you're using Supabase hosted (not local): paste the SQL into the Supabase SQL Editor in the dashboard, run, verify no errors.

- [ ] **Step 3: Verify all 5 tables exist with correct RLS**

Run this SQL via `pnpm dlx supabase db execute` or the SQL Editor:
```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('commitments','focus_queue','cycle_state','signals','spine_inbox')
order by tablename;
```

Expected output: 5 rows, all with `rowsecurity = true`.

- [ ] **Step 4: Verify indexes exist**

```sql
select indexname from pg_indexes
where schemaname = 'public'
  and tablename in ('commitments','focus_queue','cycle_state','signals','spine_inbox')
order by indexname;
```

Expected: 7 indexes (`commitments_contact_idx`, `commitments_user_due_idx`, `commitments_user_status_idx`, `cycle_state_user_next_due_idx`, `focus_queue_user_week_status_idx`, `signals_contact_idx`, `signals_user_status_sev_idx`, `spine_inbox_user_parsed_captured_idx`) plus primary key indexes.

- [ ] **Step 5: Commit**

```bash
cd ~/crm
git add supabase/migrations/20260407020000_spine_tables.sql
git commit -m "$(cat <<'EOF'
feat(spine): add 5 spine tables with RLS and indexes

Creates commitments, focus_queue, cycle_state, signals, spine_inbox
per spec section 2. All tables have RLS with auth.uid() owner policy,
CHECK constraints on enum columns, soft-delete via deleted_at per
Standing Rule 3, and indexes tuned for the /api/spine/today hot path.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add interactions -> cycle_state trigger

**Files:**
- Create: `supabase/migrations/20260407021000_spine_interactions_trigger.sql`

- [ ] **Step 1: Create the trigger migration**

```sql
-- supabase/migrations/20260407021000_spine_interactions_trigger.sql
-- Denormalizes interactions.created_at into cycle_state.last_touched_at
-- so /api/spine/today can read recent-touch data without joining.

create or replace function public.spine_update_cycle_on_interaction()
returns trigger language plpgsql security definer as $$
declare
  v_contact_tier text;
  v_default_days integer;
  v_cadence_days integer;
begin
  if new.contact_id is null then
    return new;
  end if;

  -- Look up tier from contacts to pick a default cadence.
  select tier into v_contact_tier
  from public.contacts where id = new.contact_id;

  v_default_days := case coalesce(v_contact_tier, '')
    when '1' then 7
    when 'tier1' then 7
    when '2' then 14
    when 'tier2' then 14
    when '3' then 30
    when 'tier3' then 30
    else 30
  end;

  -- Upsert cycle_state for this contact and recompute next_due_at.
  insert into public.cycle_state (contact_id, user_id, last_touched_at, next_due_at, current_streak_days, status)
  values (
    new.contact_id,
    coalesce(new.user_id, auth.uid()),
    new.created_at,
    new.created_at + make_interval(days => v_default_days),
    0,
    'active'
  )
  on conflict (contact_id) do update
  set last_touched_at = excluded.last_touched_at,
      next_due_at = excluded.last_touched_at + make_interval(
        days => coalesce(public.cycle_state.cadence_days, v_default_days)
      ),
      current_streak_days = 0,
      updated_at = now();

  return new;
end
$$;

drop trigger if exists interactions_update_cycle on public.interactions;
create trigger interactions_update_cycle
  after insert on public.interactions
  for each row execute function public.spine_update_cycle_on_interaction();
```

- [ ] **Step 2: Apply the migration**

```bash
cd ~/crm && pnpm dlx supabase db push --include-all
```

Expected: migration applied cleanly.

- [ ] **Step 3: Verify the trigger exists**

```sql
select tgname, tgrelid::regclass
from pg_trigger
where tgname = 'interactions_update_cycle';
```

Expected: 1 row, `tgrelid = public.interactions`.

- [ ] **Step 4: Smoke-test the trigger by inserting a dummy interaction**

Pick any real contact id from your contacts table:
```sql
-- Get a contact id to test with
select id, first_name, last_name, tier from public.contacts
where deleted_at is null limit 1;

-- Insert a test interaction (replace <id> with the id above)
insert into public.interactions (contact_id, user_id, type, note)
values ('<id>', auth.uid(), 'test', 'trigger smoke test');

-- Verify cycle_state got created and populated
select contact_id, last_touched_at, next_due_at, status
from public.cycle_state where contact_id = '<id>';

-- Clean up the test interaction (soft delete per Standing Rule 3)
-- NOTE: only do this if your interactions table has deleted_at. Otherwise skip cleanup.
update public.interactions set deleted_at = now()
where contact_id = '<id>' and note = 'trigger smoke test';
```

Expected: `cycle_state` row exists with `last_touched_at` = the interaction timestamp, `next_due_at` = that plus the tier cadence.

- [ ] **Step 5: Commit**

```bash
cd ~/crm
git add supabase/migrations/20260407021000_spine_interactions_trigger.sql
git commit -m "$(cat <<'EOF'
feat(spine): denorm interactions into cycle_state via trigger

Adds spine_update_cycle_on_interaction() that upserts cycle_state
when an interaction is inserted. Computes next_due_at from contact
tier (Tier 1 = 7d, Tier 2 = 14d, Tier 3 = 30d) with per-contact
cadence_days override. Enables fast reads from /api/spine/today
without joining interactions on every request.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# PART B -- SHARED LIB + API ROUTES

## Task 3: Create shared Zod schemas and types

**Files:**
- Create: `src/lib/spine/types.ts`

- [ ] **Step 1: Write the types file**

```typescript
// src/lib/spine/types.ts
// Shared Zod schemas and TypeScript types for the Spine layer.
// These are the contract between API routes, parser, and UI.

import { z } from "zod";

// ==========================
// Enums
// ==========================
export const CommitmentKind = z.enum([
  "flyer","email","intro","data","call","meeting","gift","other",
]);
export const CommitmentStatus = z.enum([
  "open","in_progress","delivered","dropped","blocked",
]);
export const CaptureSource = z.enum([
  "meeting","claude_conversation","eod","voice","micro_capture","manual","dashboard_bar",
]);
export const InboxSource = z.enum([
  "claude_session","voice","micro","eod","morning","manual","dashboard_bar",
]);
export const FocusReason = z.enum(["signal","cadence","manual","commitment"]);
export const FocusStatus = z.enum(["pending","touched","skipped","deferred"]);
export const FocusOutcome = z.enum(["warm","cold","delivered","no_answer","left_message"]);
export const SignalKind = z.enum([
  "stale","closing_soon","birthday","listing_dom","market_shift","custom",
]);
export const SignalSeverity = z.enum(["low","normal","high","urgent"]);
export const SignalStatus = z.enum(["active","acted_on","dismissed","expired"]);
export const CycleStatus = z.enum(["active","paused","dormant","lost"]);

// ==========================
// Row types
// ==========================
export const CommitmentRow = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  contact_id: z.string().uuid().nullable(),
  opportunity_id: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  kind: CommitmentKind.nullable(),
  promised_at: z.string(),
  due_at: z.string().nullable(),
  status: CommitmentStatus,
  source: CaptureSource.nullable(),
  source_ref: z.string().nullable(),
  delivered_at: z.string().nullable(),
  delivered_via: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});
export type Commitment = z.infer<typeof CommitmentRow>;

export const FocusQueueRow = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  week_of: z.string(),
  rank: z.number().nullable(),
  reason: FocusReason.nullable(),
  reason_detail: z.string().nullable(),
  suggested_action: z.string().nullable(),
  status: FocusStatus,
  touched_at: z.string().nullable(),
  touched_via: z.string().nullable(),
  outcome: FocusOutcome.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});
export type FocusQueue = z.infer<typeof FocusQueueRow>;

export const SignalRow = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  contact_id: z.string().uuid().nullable(),
  opportunity_id: z.string().uuid().nullable(),
  kind: SignalKind,
  severity: SignalSeverity,
  detected_at: z.string(),
  window_start: z.string().nullable(),
  window_end: z.string().nullable(),
  title: z.string(),
  detail: z.string().nullable(),
  suggested_action: z.string().nullable(),
  status: SignalStatus,
  acted_on_at: z.string().nullable(),
  created_at: z.string(),
  deleted_at: z.string().nullable(),
});
export type Signal = z.infer<typeof SignalRow>;

export const CycleStateRow = z.object({
  contact_id: z.string().uuid(),
  user_id: z.string().uuid(),
  cadence_days: z.number().nullable(),
  tier_override: z.string().nullable(),
  paused_until: z.string().nullable(),
  last_touched_at: z.string().nullable(),
  next_due_at: z.string().nullable(),
  current_streak_days: z.number().nullable(),
  status: CycleStatus.nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CycleState = z.infer<typeof CycleStateRow>;

export const SpineInboxRow = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  raw_text: z.string(),
  source: InboxSource,
  source_ref: z.string().nullable(),
  captured_at: z.string(),
  parsed: z.boolean(),
  parsed_at: z.string().nullable(),
  parsed_commitment_ids: z.array(z.string().uuid()).nullable(),
  parsed_signal_ids: z.array(z.string().uuid()).nullable(),
  parsed_focus_ids: z.array(z.string().uuid()).nullable(),
  parsed_contact_refs: z.array(z.string().uuid()).nullable(),
  parse_notes: z.string().nullable(),
  deleted_at: z.string().nullable(),
});
export type SpineInbox = z.infer<typeof SpineInboxRow>;

// ==========================
// Input schemas (API request bodies)
// ==========================
export const CaptureInput = z.object({
  raw_text: z.string().min(1).max(4000),
  source: InboxSource.default("dashboard_bar"),
  source_ref: z.string().optional(),
});

export const CommitmentCreate = z.object({
  contact_id: z.string().uuid().nullable().optional(),
  opportunity_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  kind: CommitmentKind.optional(),
  due_at: z.string().datetime().nullable().optional(),
  source: CaptureSource.default("manual"),
  source_ref: z.string().optional(),
});

export const CommitmentUpdate = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  kind: CommitmentKind.optional(),
  due_at: z.string().datetime().nullable().optional(),
  status: CommitmentStatus.optional(),
  delivered_at: z.string().datetime().optional(),
  delivered_via: z.string().optional(),
  notes: z.string().optional(),
});

export const SignalCreate = z.object({
  contact_id: z.string().uuid().nullable().optional(),
  opportunity_id: z.string().uuid().nullable().optional(),
  kind: SignalKind,
  severity: SignalSeverity.default("normal"),
  title: z.string().min(1).max(500),
  detail: z.string().optional(),
  window_start: z.string().optional(),
  window_end: z.string().optional(),
  suggested_action: z.string().optional(),
});

export const SignalUpdate = z.object({
  status: SignalStatus.optional(),
  severity: SignalSeverity.optional(),
  suggested_action: z.string().optional(),
});

export const FocusCreate = z.object({
  contact_id: z.string().uuid(),
  week_of: z.string().optional(), // default current Monday
  rank: z.number().int().min(1).max(10).optional(),
  reason: FocusReason.default("manual"),
  reason_detail: z.string().optional(),
  suggested_action: z.string().optional(),
});

export const FocusUpdate = z.object({
  status: FocusStatus.optional(),
  rank: z.number().int().min(1).max(10).optional(),
  touched_via: z.string().optional(),
  outcome: FocusOutcome.optional(),
  reason_detail: z.string().optional(),
});

export const CycleUpdate = z.object({
  cadence_days: z.number().int().min(1).max(365).nullable().optional(),
  tier_override: z.string().nullable().optional(),
  paused_until: z.string().nullable().optional(),
  status: CycleStatus.optional(),
  notes: z.string().nullable().optional(),
});

// ==========================
// /api/spine/today response
// ==========================
export const TodayPayload = z.object({
  today_focus: z.array(z.object({
    focus: FocusQueueRow,
    contact: z.object({
      id: z.string().uuid(),
      first_name: z.string(),
      last_name: z.string(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      avatar_url: z.string().nullable(),
      tier: z.string().nullable(),
    }),
  })),
  overdue_commitments: z.array(CommitmentRow),
  high_signals: z.array(SignalRow),
  coming_due: z.array(z.object({
    cycle: CycleStateRow,
    contact: z.object({
      id: z.string().uuid(),
      first_name: z.string(),
      last_name: z.string(),
    }),
  })),
  week_rotation_summary: z.object({
    total: z.number(),
    pending: z.number(),
    touched: z.number(),
    skipped: z.number(),
    deferred: z.number(),
  }),
  recent_captures: z.array(SpineInboxRow),
  content_calendar: z.array(z.object({
    title: z.string(),
    scheduled_for: z.string(),
    kind: z.string(), // weekly_edge | toolkit | closing_brief
  })),
});
export type TodayPayloadT = z.infer<typeof TodayPayload>;
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd ~/crm && pnpm exec tsc --noEmit
```

Expected: Zero new errors. If baseline had pre-existing errors, the count should not increase.

- [ ] **Step 3: Commit**

```bash
cd ~/crm
git add src/lib/spine/types.ts
git commit -m "$(cat <<'EOF'
feat(spine): add shared Zod schemas and TypeScript types

Defines row shapes, enums, and input schemas for all 5 spine tables
plus the TodayPayload composite returned by /api/spine/today.
Single source of truth for API contracts and parser output.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create spine query helpers

**Files:**
- Create: `src/lib/spine/queries.ts`

- [ ] **Step 1: Write the query helpers**

```typescript
// src/lib/spine/queries.ts
// Server-side Supabase query helpers for the spine.
// Used by API routes. Assumes the Supabase client is passed in.

import { SupabaseClient } from "@supabase/supabase-js";
import type { TodayPayloadT } from "./types";

/**
 * Returns the ISO date string for Monday of the current week (UTC).
 */
export function currentMondayISO(d: Date = new Date()): string {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Mon = 1
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

/**
 * Fetches the full Today Command payload in one round-trip set.
 * Caller must provide a session-authed or service-role Supabase client.
 */
export async function fetchTodayPayload(
  supabase: SupabaseClient,
  userId: string
): Promise<TodayPayloadT> {
  const weekOf = currentMondayISO();
  const now = new Date().toISOString();
  const in48h = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

  // Run queries in parallel.
  const [
    focusRes,
    overdueRes,
    signalsRes,
    comingDueRes,
    weekSummaryRes,
    capturesRes,
  ] = await Promise.all([
    supabase
      .from("focus_queue")
      .select(`
        *,
        contact:contacts(id,first_name,last_name,email,phone,avatar_url,tier)
      `)
      .eq("user_id", userId)
      .eq("week_of", weekOf)
      .eq("status", "pending")
      .is("deleted_at", null)
      .order("rank", { ascending: true })
      .limit(5),
    supabase
      .from("commitments")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "open")
      .lt("due_at", now)
      .is("deleted_at", null)
      .order("due_at", { ascending: true })
      .limit(20),
    supabase
      .from("signals")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("severity", ["high", "urgent"])
      .gt("window_end", now)
      .is("deleted_at", null)
      .order("severity", { ascending: false })
      .limit(10),
    supabase
      .from("cycle_state")
      .select(`
        *,
        contact:contacts(id,first_name,last_name)
      `)
      .eq("user_id", userId)
      .eq("status", "active")
      .lt("next_due_at", in48h)
      .gte("next_due_at", now)
      .order("next_due_at", { ascending: true })
      .limit(10),
    supabase
      .from("focus_queue")
      .select("status")
      .eq("user_id", userId)
      .eq("week_of", weekOf)
      .is("deleted_at", null),
    supabase
      .from("spine_inbox")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("captured_at", { ascending: false })
      .limit(5),
  ]);

  // Surface errors.
  for (const res of [focusRes, overdueRes, signalsRes, comingDueRes, weekSummaryRes, capturesRes]) {
    if (res.error) throw new Error(`spine query failed: ${res.error.message}`);
  }

  // Build week summary
  const statuses = (weekSummaryRes.data ?? []).map((r: { status: string }) => r.status);
  const weekRotationSummary = {
    total: statuses.length,
    pending: statuses.filter((s: string) => s === "pending").length,
    touched: statuses.filter((s: string) => s === "touched").length,
    skipped: statuses.filter((s: string) => s === "skipped").length,
    deferred: statuses.filter((s: string) => s === "deferred").length,
  };

  // Content calendar: placeholder that returns an empty list for Phase 1.
  // Phase 5 will populate this from actual schedule sources.
  const contentCalendar: TodayPayloadT["content_calendar"] = [];

  return {
    today_focus: (focusRes.data ?? []).map((row: Record<string, unknown>) => ({
      focus: {
        id: row.id as string,
        user_id: row.user_id as string,
        contact_id: row.contact_id as string,
        week_of: row.week_of as string,
        rank: row.rank as number | null,
        reason: row.reason as "signal" | "cadence" | "manual" | "commitment" | null,
        reason_detail: row.reason_detail as string | null,
        suggested_action: row.suggested_action as string | null,
        status: row.status as "pending" | "touched" | "skipped" | "deferred",
        touched_at: row.touched_at as string | null,
        touched_via: row.touched_via as string | null,
        outcome: row.outcome as "warm" | "cold" | "delivered" | "no_answer" | "left_message" | null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        deleted_at: row.deleted_at as string | null,
      },
      contact: row.contact as TodayPayloadT["today_focus"][number]["contact"],
    })),
    overdue_commitments: (overdueRes.data ?? []) as TodayPayloadT["overdue_commitments"],
    high_signals: (signalsRes.data ?? []) as TodayPayloadT["high_signals"],
    coming_due: (comingDueRes.data ?? []).map((row: Record<string, unknown>) => ({
      cycle: {
        contact_id: row.contact_id as string,
        user_id: row.user_id as string,
        cadence_days: row.cadence_days as number | null,
        tier_override: row.tier_override as string | null,
        paused_until: row.paused_until as string | null,
        last_touched_at: row.last_touched_at as string | null,
        next_due_at: row.next_due_at as string | null,
        current_streak_days: row.current_streak_days as number | null,
        status: row.status as "active" | "paused" | "dormant" | "lost" | null,
        notes: row.notes as string | null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
      },
      contact: row.contact as TodayPayloadT["coming_due"][number]["contact"],
    })),
    week_rotation_summary: weekRotationSummary,
    recent_captures: (capturesRes.data ?? []) as TodayPayloadT["recent_captures"],
    content_calendar: contentCalendar,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ~/crm && pnpm exec tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
cd ~/crm
git add src/lib/spine/queries.ts
git commit -m "$(cat <<'EOF'
feat(spine): add fetchTodayPayload query helper

Single-function hot path that runs 6 parallel Supabase queries and
assembles the TodayPayload for /api/spine/today. currentMondayISO()
computes the week_of anchor for focus_queue lookups.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: GET /api/spine/today route

**Files:**
- Create: `src/app/api/spine/today/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/spine/today/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchTodayPayload } from "@/lib/spine/queries";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await fetchTodayPayload(supabase, user.id);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Start the dev server**

```bash
cd ~/crm && pnpm dev
```

Wait for "Ready in ..." line.

- [ ] **Step 3: Verify the route returns a valid payload**

In a second shell, while logged in via browser, open devtools and copy a session cookie. Or use the Supabase client directly. For a quick smoke test, hit the route:

```bash
curl -i http://localhost:3000/api/spine/today
```

Expected: `401 Unauthorized` (since no session). That proves auth gate works.

Then sign in via the browser at `http://localhost:3000/login`, navigate to `http://localhost:3000/api/spine/today` directly in the browser address bar.

Expected: JSON with keys `today_focus`, `overdue_commitments`, `high_signals`, `coming_due`, `week_rotation_summary`, `recent_captures`, `content_calendar`. All arrays should be empty (no spine data yet) except `week_rotation_summary` which should be `{ total: 0, pending: 0, touched: 0, skipped: 0, deferred: 0 }`.

- [ ] **Step 4: Stop the dev server (Ctrl+C) and commit**

```bash
cd ~/crm
git add src/app/api/spine/today/route.ts
git commit -m "$(cat <<'EOF'
feat(spine): add GET /api/spine/today hot path

Returns full Today Command payload in one request. Session-authed,
no-store cache headers, uses fetchTodayPayload helper.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: POST /api/spine/capture route

**Files:**
- Create: `src/app/api/spine/capture/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/spine/capture/route.ts
// Accepts raw text (from dashboard bar, mobile capture, voice, etc.)
// and writes it to spine_inbox unparsed. Parser cron picks it up later.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CaptureInput } from "@/lib/spine/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CaptureInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { raw_text, source, source_ref } = parsed.data;

  const { data, error } = await supabase
    .from("spine_inbox")
    .insert({
      user_id: user.id,
      raw_text,
      source,
      source_ref: source_ref ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inbox: data }, { status: 201 });
}
```

- [ ] **Step 2: Start dev server and verify capture works**

```bash
cd ~/crm && pnpm dev
```

- [ ] **Step 3: Capture a test entry via the signed-in browser session**

In browser devtools console (while signed in at localhost:3000):

```javascript
await fetch('/api/spine/capture', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    raw_text: 'test capture from browser console',
    source: 'dashboard_bar'
  })
}).then(r => r.json())
```

Expected: `{ inbox: { id: "...", raw_text: "test capture...", parsed: false, ... } }`.

- [ ] **Step 4: Verify the row lands in spine_inbox**

Via Supabase SQL editor:
```sql
select id, raw_text, source, parsed, captured_at
from public.spine_inbox
where raw_text like 'test capture%'
order by captured_at desc limit 1;
```

Expected: 1 row, `parsed = false`.

- [ ] **Step 5: Commit**

```bash
cd ~/crm
git add src/app/api/spine/capture/route.ts
git commit -m "$(cat <<'EOF'
feat(spine): add POST /api/spine/capture

Session-authed endpoint that writes raw text to spine_inbox with
Zod-validated input. Single entry point for dashboard bar, mobile
capture, and all non-Claude-session capture sources.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: GET /api/spine/inbox + POST /api/spine/parse/:id routes

**Files:**
- Create: `src/app/api/spine/inbox/route.ts`
- Create: `src/app/api/spine/parse/[inboxId]/route.ts`

- [ ] **Step 1: Write the inbox list route**

```typescript
// src/app/api/spine/inbox/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const parsedFilter = url.searchParams.get("parsed");

  let q = supabase
    .from("spine_inbox")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("captured_at", { ascending: false })
    .limit(limit);

  if (parsedFilter === "true") q = q.eq("parsed", true);
  else if (parsedFilter === "false") q = q.eq("parsed", false);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inbox: data ?? [] });
}
```

- [ ] **Step 2: Write the parse trigger route (stub for now, real parser in Task 11)**

```typescript
// src/app/api/spine/parse/[inboxId]/route.ts
// Triggers the parser for a specific inbox entry. Used for retry and
// by Claude Code skill for inline parse. Real parser logic lives in
// src/lib/spine/parser.ts (Task 11).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiToken } from "@/lib/api-auth";
import { parseInboxEntry } from "@/lib/spine/parser";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { inboxId: string } }
) {
  // Allow both session and bearer token.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const unauth = requireApiToken(request);
    if (unauth) return unauth;
  }

  const { inboxId } = params;
  const result = await parseInboxEntry(inboxId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ parsed: result.data });
}
```

- [ ] **Step 3: Create a parser placeholder so this compiles**

```typescript
// src/lib/spine/parser.ts
// Real implementation in Task 11. Stub for now so parse route compiles.

export type ParseResult =
  | { ok: true; data: { id: string; parsed: boolean } }
  | { ok: false; error: string };

export async function parseInboxEntry(inboxId: string): Promise<ParseResult> {
  return { ok: false, error: "parser not yet implemented, see Task 11" };
}
```

- [ ] **Step 4: Verify compile and manually hit the inbox route**

```bash
cd ~/crm && pnpm exec tsc --noEmit
```

Expected: zero new errors.

Then:
```bash
cd ~/crm && pnpm dev
```

In browser (signed in):
```javascript
await fetch('/api/spine/inbox?limit=10').then(r => r.json())
```

Expected: `{ inbox: [{ id: "...", raw_text: "test capture...", parsed: false, ... }] }` (the entry from Task 6).

- [ ] **Step 5: Commit**

```bash
cd ~/crm
git add src/app/api/spine/inbox/route.ts src/app/api/spine/parse src/lib/spine/parser.ts
git commit -m "$(cat <<'EOF'
feat(spine): add /api/spine/inbox list and /api/spine/parse/:id routes

inbox route returns user's captures with parsed-filter and limit.
parse route accepts session OR bearer auth, calls parseInboxEntry()
stub. Real parser arrives in Task 11.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Commitments CRUD routes

**Files:**
- Create: `src/app/api/spine/commitments/route.ts`
- Create: `src/app/api/spine/commitments/[id]/route.ts`

- [ ] **Step 1: Write the list + create route**

```typescript
// src/app/api/spine/commitments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CommitmentCreate } from "@/lib/spine/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const contactId = url.searchParams.get("contact_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);

  let q = supabase
    .from("commitments")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (status) q = q.eq("status", status);
  if (contactId) q = q.eq("contact_id", contactId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ commitments: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = CommitmentCreate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("commitments")
    .insert({
      user_id: user.id,
      contact_id: parsed.data.contact_id ?? null,
      opportunity_id: parsed.data.opportunity_id ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      kind: parsed.data.kind ?? null,
      due_at: parsed.data.due_at ?? null,
      source: parsed.data.source,
      source_ref: parsed.data.source_ref ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ commitment: data }, { status: 201 });
}
```

- [ ] **Step 2: Write the per-id patch route**

```typescript
// src/app/api/spine/commitments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CommitmentUpdate } from "@/lib/spine/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = CommitmentUpdate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("commitments")
    .update(parsed.data)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ commitment: data });
}
```

- [ ] **Step 3: Verify compile + smoke test**

```bash
cd ~/crm && pnpm exec tsc --noEmit && pnpm dev
```

In browser console (signed in):
```javascript
// Create
const c = await fetch('/api/spine/commitments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'test commitment',
    kind: 'flyer',
    source: 'manual'
  })
}).then(r => r.json());
console.log('created', c);

// List
const list = await fetch('/api/spine/commitments?status=open').then(r => r.json());
console.log('list', list);

// Patch
const patched = await fetch(`/api/spine/commitments/${c.commitment.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'delivered' })
}).then(r => r.json());
console.log('patched', patched);
```

Expected: create returns 201 with `commitment.id`, list includes it, patch flips status to `delivered`.

- [ ] **Step 4: Commit**

```bash
cd ~/crm
git add src/app/api/spine/commitments
git commit -m "$(cat <<'EOF'
feat(spine): add commitments CRUD routes

GET/POST on /api/spine/commitments with status and contact_id filters,
PATCH on /api/spine/commitments/:id for status and delivery updates.
Session-authed with Zod validation. Respects soft-delete.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Signals CRUD routes

**Files:**
- Create: `src/app/api/spine/signals/route.ts`
- Create: `src/app/api/spine/signals/[id]/route.ts`

- [ ] **Step 1: Write the list + create route**

```typescript
// src/app/api/spine/signals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiToken } from "@/lib/api-auth";
import { SignalCreate } from "@/lib/spine/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "active";
  const severity = url.searchParams.get("severity");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);

  let q = supabase
    .from("signals")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", status)
    .is("deleted_at", null)
    .order("severity", { ascending: false })
    .order("detected_at", { ascending: false })
    .limit(limit);

  if (severity) q = q.eq("severity", severity);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signals: data ?? [] });
}

export async function POST(request: NextRequest) {
  // Accept session OR bearer (for cron/scout pushes)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let userId = user?.id ?? null;

  if (!userId) {
    const unauth = requireApiToken(request);
    if (unauth) return unauth;
    // For bearer-auth writes, must include user_id in body.
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = SignalCreate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // If bearer-auth, body must supply target user_id.
  const targetUserId = userId ?? (body as { user_id?: string }).user_id;
  if (!targetUserId) {
    return NextResponse.json(
      { error: "Bearer auth requires user_id in body" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("signals")
    .insert({
      user_id: targetUserId,
      contact_id: parsed.data.contact_id ?? null,
      opportunity_id: parsed.data.opportunity_id ?? null,
      kind: parsed.data.kind,
      severity: parsed.data.severity,
      title: parsed.data.title,
      detail: parsed.data.detail ?? null,
      window_start: parsed.data.window_start ?? null,
      window_end: parsed.data.window_end ?? null,
      suggested_action: parsed.data.suggested_action ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signal: data }, { status: 201 });
}
```

- [ ] **Step 2: Write the per-id patch route**

```typescript
// src/app/api/spine/signals/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SignalUpdate } from "@/lib/spine/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = SignalUpdate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "acted_on") updates.acted_on_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("signals")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ signal: data });
}
```

- [ ] **Step 3: Verify compile + smoke test**

```bash
cd ~/crm && pnpm exec tsc --noEmit && pnpm dev
```

Browser console:
```javascript
const s = await fetch('/api/spine/signals', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    kind: 'custom',
    severity: 'high',
    title: 'test signal',
    detail: 'manual test from browser'
  })
}).then(r => r.json());
console.log('created', s);

const list = await fetch('/api/spine/signals?severity=high').then(r => r.json());
console.log('list', list);

await fetch(`/api/spine/signals/${s.signal.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'dismissed' })
}).then(r => r.json());
```

Expected: create returns 201 with `signal.id`, list contains it, patch flips status.

- [ ] **Step 4: Commit**

```bash
cd ~/crm
git add src/app/api/spine/signals
git commit -m "$(cat <<'EOF'
feat(spine): add signals CRUD routes

GET filters by status and severity, POST accepts session or bearer
(for cron writes from research-scout and edge functions), PATCH
auto-stamps acted_on_at when status flips to acted_on.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Focus queue CRUD routes

**Files:**
- Create: `src/app/api/spine/focus/route.ts`
- Create: `src/app/api/spine/focus/[id]/route.ts`

- [ ] **Step 1: Write the list + create route**

```typescript
// src/app/api/spine/focus/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FocusCreate } from "@/lib/spine/types";
import { currentMondayISO } from "@/lib/spine/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const weekOf = url.searchParams.get("week_of") ?? currentMondayISO();
  const status = url.searchParams.get("status");

  let q = supabase
    .from("focus_queue")
    .select(`*, contact:contacts(id,first_name,last_name,email,phone,avatar_url,tier)`)
    .eq("user_id", user.id)
    .eq("week_of", weekOf)
    .is("deleted_at", null)
    .order("rank", { ascending: true });

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ focus_queue: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = FocusCreate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const weekOf = parsed.data.week_of ?? currentMondayISO();

  const { data, error } = await supabase
    .from("focus_queue")
    .insert({
      user_id: user.id,
      contact_id: parsed.data.contact_id,
      week_of: weekOf,
      rank: parsed.data.rank ?? null,
      reason: parsed.data.reason,
      reason_detail: parsed.data.reason_detail ?? null,
      suggested_action: parsed.data.suggested_action ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ focus: data }, { status: 201 });
}
```

- [ ] **Step 2: Write the per-id patch route**

```typescript
// src/app/api/spine/focus/[id]/route.ts
// PATCH handles all quick actions: touched, skipped, deferred, rank changes.
// When touched, creates an interactions row so the trigger updates cycle_state.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FocusUpdate } from "@/lib/spine/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = FocusUpdate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "touched") {
    updates.touched_at = new Date().toISOString();
  }

  // Fetch the focus row first so we know the contact_id for interaction insert.
  const { data: existing, error: fetchErr } = await supabase
    .from("focus_queue")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("focus_queue")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If touched, insert an interaction so the trigger denorms cycle_state.
  if (parsed.data.status === "touched") {
    await supabase.from("interactions").insert({
      user_id: user.id,
      contact_id: existing.contact_id,
      type: parsed.data.touched_via ?? "other",
      note: `Touched via Today Command${parsed.data.outcome ? ` (${parsed.data.outcome})` : ""}`,
    });
  }

  return NextResponse.json({ focus: data });
}
```

- [ ] **Step 3: Verify compile + smoke test**

```bash
cd ~/crm && pnpm exec tsc --noEmit && pnpm dev
```

Browser console (pick a real contact_id from your contacts table first):
```javascript
// Use the id of a real contact you have
const CONTACT_ID = 'PASTE_REAL_CONTACT_ID_HERE';

const f = await fetch('/api/spine/focus', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contact_id: CONTACT_ID,
    rank: 1,
    reason: 'manual',
    reason_detail: 'testing focus queue'
  })
}).then(r => r.json());
console.log('created', f);

const list = await fetch('/api/spine/focus').then(r => r.json());
console.log('list', list);

await fetch(`/api/spine/focus/${f.focus.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'touched', touched_via: 'call', outcome: 'warm' })
}).then(r => r.json());
```

Expected: create returns 201, list includes the focus row with joined `contact`, PATCH returns updated focus row with `touched_at` set. Verify via SQL that an `interactions` row was inserted and `cycle_state.last_touched_at` advanced.

- [ ] **Step 4: Commit**

```bash
cd ~/crm
git add src/app/api/spine/focus
git commit -m "$(cat <<'EOF'
feat(spine): add focus_queue CRUD routes

GET joins contact columns for fast render, POST inserts for current
week with conflict handling, PATCH handles quick actions and on
touched auto-creates an interactions row so the trigger advances
cycle_state.last_touched_at and next_due_at.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Cycle state route

**Files:**
- Create: `src/app/api/spine/cycle/[contactId]/route.ts`

- [ ] **Step 1: Write the GET + PATCH route**

```typescript
// src/app/api/spine/cycle/[contactId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CycleUpdate } from "@/lib/spine/types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("cycle_state")
    .select("*")
    .eq("contact_id", params.contactId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cycle: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = CycleUpdate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("cycle_state")
    .upsert(
      { contact_id: params.contactId, user_id: user.id, ...parsed.data },
      { onConflict: "contact_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cycle: data });
}
```

- [ ] **Step 2: Verify compile + smoke test**

```bash
cd ~/crm && pnpm exec tsc --noEmit && pnpm dev
```

Browser console:
```javascript
const CONTACT_ID = 'PASTE_REAL_CONTACT_ID_HERE';

// Read (may be null if no cycle_state yet)
const existing = await fetch(`/api/spine/cycle/${CONTACT_ID}`).then(r => r.json());
console.log('existing', existing);

// Upsert
const patched = await fetch(`/api/spine/cycle/${CONTACT_ID}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cadence_days: 10, notes: 'testing cycle update' })
}).then(r => r.json());
console.log('patched', patched);
```

Expected: PATCH returns `{ cycle: { contact_id, cadence_days: 10, notes: "testing...", ... } }`.

- [ ] **Step 3: Commit**

```bash
cd ~/crm
git add src/app/api/spine/cycle
git commit -m "$(cat <<'EOF'
feat(spine): add cycle_state GET/PATCH route

Per-contact cadence tuning endpoint. PATCH upserts so first call
creates the row. Used by UI cycle panel and by the learning loop
(Phase 4) to auto-tune cadence_days.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# PART C -- PARSER + CRONS + SEED

## Task 12: Install @anthropic-ai/sdk and implement the parser

**Files:**
- Modify: `package.json`
- Modify: `src/lib/spine/parser.ts`

- [ ] **Step 1: Install the Anthropic SDK**

```bash
cd ~/crm && pnpm add @anthropic-ai/sdk
```

Expected: package installed, lockfile updated, no errors.

- [ ] **Step 2: Confirm ANTHROPIC_API_KEY is in `.env.local`**

If not present, add the line:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Alex action: paste the real key if not already set. Do not commit `.env.local`.

- [ ] **Step 3: Replace the parser stub with the real implementation**

```typescript
// src/lib/spine/parser.ts
// Background parser. Reads unparsed spine_inbox rows and turns them
// into structured commitments, signals, and focus_queue rows using
// Claude API. Writes back parsed_* arrays and marks parsed=true.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Output schema we ask Claude to produce.
const ParserOutput = z.object({
  contacts_mentioned: z.array(z.object({
    guess_first_name: z.string().optional(),
    guess_last_name: z.string().optional(),
    guess_brokerage: z.string().optional(),
    matched_contact_id: z.string().uuid().nullable(),
    confidence: z.enum(["high","medium","low"]),
  })),
  commitments: z.array(z.object({
    title: z.string(),
    kind: z.enum(["flyer","email","intro","data","call","meeting","gift","other"]).nullable(),
    due_at_relative: z.string().nullable(), // "by Friday", "end of week"
    target_contact_id: z.string().uuid().nullable(),
    description: z.string().nullable(),
  })),
  signals: z.array(z.object({
    kind: z.enum(["stale","closing_soon","birthday","listing_dom","market_shift","custom"]),
    severity: z.enum(["low","normal","high","urgent"]),
    title: z.string(),
    detail: z.string().nullable(),
    target_contact_id: z.string().uuid().nullable(),
  })),
  focus_adds: z.array(z.object({
    contact_id: z.string().uuid(),
    reason_detail: z.string(),
  })),
  warnings: z.array(z.string()),
});

export type ParseResult =
  | { ok: true; data: { id: string; parsed: boolean; parsed_commitment_ids: string[]; parsed_signal_ids: string[]; parsed_focus_ids: string[] } }
  | { ok: false; error: string };

const SYSTEM_PROMPT = `You are the Spine parser for a real estate title sales executive's CRM. You turn raw text captures into structured database writes.

Given a raw_text capture and a contacts index, extract:
1. Contacts mentioned (match to contacts index where possible)
2. Commitments made ("I'll send her the flyer by Friday" -> commitment with kind=flyer)
3. Signals observed ("she's closing Friday" -> closing_soon signal)
4. Focus intent ("make sure I call Kevin this week" -> focus_queue add)

Rules:
- Return JSON matching the provided schema exactly.
- Use "matched_contact_id": null if you cannot confidently match a named person.
- For "due_at_relative", return human phrases like "by Friday", "end of week" -- do NOT compute dates.
- For commitment kind: flyer, email, intro, data, call, meeting, gift, other.
- Severity defaults to "normal" unless the text explicitly suggests urgency.
- Return empty arrays for categories with nothing to extract.
- If lender separation rules are violated (Christine McConnell mentioned without Julie Jarmiolowski + Optima context), add a warning string.
- Return only the JSON object. No prose, no markdown fences.`;

async function buildContactsIndex(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data } = await supabase
    .from("contacts")
    .select("id,first_name,last_name,brokerage,email,phone,tier")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("first_name")
    .limit(500);
  return (data ?? []).map((c: Record<string, unknown>) => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
    brokerage: c.brokerage,
    tier: c.tier,
  }));
}

/**
 * Parses a single spine_inbox entry. Uses service-role Supabase client.
 * Call with the inbox row id. Reads the row, runs Claude, writes results.
 */
export async function parseInboxEntry(inboxId: string): Promise<ParseResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !serviceKey || !apiKey) {
    return { ok: false, error: "Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or ANTHROPIC_API_KEY" };
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const anthropic = new Anthropic({ apiKey });

  // Fetch the inbox row.
  const { data: row, error: fetchErr } = await supabase
    .from("spine_inbox")
    .select("*")
    .eq("id", inboxId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!row) return { ok: false, error: "inbox row not found" };
  if (row.parsed) return { ok: false, error: "already parsed" };

  // Build contacts index for the user.
  const contactsIndex = await buildContactsIndex(supabase, row.user_id);

  // Call Claude.
  const userMessage = `CONTACTS INDEX (up to 500):\n${JSON.stringify(contactsIndex)}\n\nRAW TEXT TO PARSE:\n${row.raw_text}\n\nReturn the JSON object now.`;

  let parsedJson: z.infer<typeof ParserOutput>;
  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("");

    parsedJson = ParserOutput.parse(JSON.parse(text));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown parser error";
    await supabase
      .from("spine_inbox")
      .update({ parse_notes: `parse failed: ${msg}` })
      .eq("id", inboxId);
    return { ok: false, error: `parse failed: ${msg}` };
  }

  // Write commitments
  const commitmentIds: string[] = [];
  for (const c of parsedJson.commitments) {
    const { data: inserted, error } = await supabase
      .from("commitments")
      .insert({
        user_id: row.user_id,
        contact_id: c.target_contact_id,
        title: c.title,
        description: c.description,
        kind: c.kind,
        source: row.source === "dashboard_bar" ? "dashboard_bar" : "manual",
        source_ref: row.id,
      })
      .select("id")
      .single();
    if (!error && inserted) commitmentIds.push(inserted.id);
  }

  // Write signals
  const signalIds: string[] = [];
  for (const s of parsedJson.signals) {
    const { data: inserted, error } = await supabase
      .from("signals")
      .insert({
        user_id: row.user_id,
        contact_id: s.target_contact_id,
        kind: s.kind,
        severity: s.severity,
        title: s.title,
        detail: s.detail,
      })
      .select("id")
      .single();
    if (!error && inserted) signalIds.push(inserted.id);
  }

  // Write focus_adds
  const focusIds: string[] = [];
  for (const f of parsedJson.focus_adds) {
    const { data: inserted, error } = await supabase
      .from("focus_queue")
      .insert({
        user_id: row.user_id,
        contact_id: f.contact_id,
        week_of: new Date().toISOString().split("T")[0], // caller computes Monday
        reason: "manual",
        reason_detail: f.reason_detail,
      })
      .select("id")
      .single();
    if (!error && inserted) focusIds.push(inserted.id);
  }

  // Collect contact refs
  const contactRefs = parsedJson.contacts_mentioned
    .map(c => c.matched_contact_id)
    .filter((x): x is string => x !== null);

  // Mark inbox row parsed
  const warnings = parsedJson.warnings.length > 0 ? parsedJson.warnings.join(" | ") : null;
  const { data: updated, error: updateErr } = await supabase
    .from("spine_inbox")
    .update({
      parsed: true,
      parsed_at: new Date().toISOString(),
      parsed_commitment_ids: commitmentIds,
      parsed_signal_ids: signalIds,
      parsed_focus_ids: focusIds,
      parsed_contact_refs: contactRefs,
      parse_notes: warnings,
    })
    .eq("id", inboxId)
    .select()
    .single();

  if (updateErr) return { ok: false, error: updateErr.message };

  return {
    ok: true,
    data: {
      id: updated.id,
      parsed: updated.parsed,
      parsed_commitment_ids: commitmentIds,
      parsed_signal_ids: signalIds,
      parsed_focus_ids: focusIds,
    },
  };
}
```

- [ ] **Step 4: Verify compile**

```bash
cd ~/crm && pnpm exec tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 5: Manually test the parser end-to-end**

Start dev server, capture a test entry, then trigger parse:

```bash
cd ~/crm && pnpm dev
```

Browser console (signed in):
```javascript
// 1. Capture
const cap = await fetch('/api/spine/capture', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    raw_text: 'I promised Julie a flyer for 2415 E Palm Ln by Friday',
    source: 'dashboard_bar'
  })
}).then(r => r.json());
console.log('captured', cap);

// 2. Parse
const parsed = await fetch(`/api/spine/parse/${cap.inbox.id}`, { method: 'POST' })
  .then(r => r.json());
console.log('parsed', parsed);

// 3. List commitments to see the result
const commits = await fetch('/api/spine/commitments?status=open').then(r => r.json());
console.log('commitments', commits);
```

Expected: `parsed.parsed === true`, and the commitments list contains a new row with title mentioning a flyer for Julie.

- [ ] **Step 6: Commit**

```bash
cd ~/crm
git add package.json pnpm-lock.yaml src/lib/spine/parser.ts
git commit -m "$(cat <<'EOF'
feat(spine): implement Claude-powered parser

parseInboxEntry() fetches an unparsed spine_inbox row, builds a
contacts index for fuzzy matching, asks Claude Opus 4.6 to extract
commitments/signals/focus_adds as structured JSON, validates with
Zod, writes rows to each table, marks inbox parsed with ID arrays.

Adds @anthropic-ai/sdk dependency. Requires ANTHROPIC_API_KEY and
SUPABASE_SERVICE_ROLE_KEY in .env.local.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Deploy parser as scheduled edge function

**Files:**
- Create: `supabase/functions/spine-parser/index.ts`

- [ ] **Step 1: Write the edge function**

Edge functions run on Deno. We'll replicate parser logic inline (Deno imports differ from Node, so we can't reuse `src/lib/spine/parser.ts` directly).

```typescript
// supabase/functions/spine-parser/index.ts
// Deno edge function. Runs every 5 minutes via Supabase cron.
// Reads unparsed spine_inbox rows, posts each to /api/spine/parse/:id
// which does the actual Claude API call.
// Deploying: supabase functions deploy spine-parser --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:3000";
const INTERNAL_API_TOKEN = Deno.env.get("INTERNAL_API_TOKEN")!;

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Fetch up to 20 unparsed entries.
  const { data: rows, error } = await supabase
    .from("spine_inbox")
    .select("id")
    .eq("parsed", false)
    .is("deleted_at", null)
    .order("captured_at", { ascending: true })
    .limit(20);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const row of rows ?? []) {
    try {
      const res = await fetch(`${APP_URL}/api/spine/parse/${row.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${INTERNAL_API_TOKEN}`,
        },
      });
      const body = await res.json();
      results.push({ id: row.id, ok: res.ok, error: res.ok ? undefined : body.error });
    } catch (err) {
      results.push({ id: row.id, ok: false, error: String(err) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Deploy the function**

```bash
cd ~/crm && pnpm dlx supabase functions deploy spine-parser --no-verify-jwt
```

Expected: deployment success message.

- [ ] **Step 3: Configure function secrets**

```bash
pnpm dlx supabase secrets set \
  APP_URL=https://your-deployed-app.vercel.app \
  INTERNAL_API_TOKEN="$(grep INTERNAL_API_TOKEN ~/crm/.env.local | cut -d= -f2-)"
```

If you're testing locally only, set `APP_URL=http://host.docker.internal:3000`.

Expected: secrets set confirmation.

- [ ] **Step 4: Schedule the function via Supabase cron (5 min)**

In Supabase dashboard -> Database -> Extensions -> enable `pg_cron` and `pg_net` if not already enabled. Then run this SQL:

```sql
select cron.schedule(
  'spine-parser-every-5min',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://<project-ref>.functions.supabase.co/spine-parser',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      )
    );
  $$
);
```

Replace `<project-ref>` with the actual project ref from Supabase dashboard.

Expected: returns a cron job id.

- [ ] **Step 5: Verify manual invocation works**

```bash
curl -X POST https://<project-ref>.functions.supabase.co/spine-parser \
  -H "Authorization: Bearer $(grep SUPABASE_SERVICE_ROLE_KEY ~/crm/.env.local | cut -d= -f2-)"
```

Expected: JSON response with `processed: N, results: [...]`.

- [ ] **Step 6: Commit**

```bash
cd ~/crm
git add supabase/functions/spine-parser
git commit -m "$(cat <<'EOF'
feat(spine): deploy parser edge function on 5min cron

Reads up to 20 unparsed inbox rows, posts each to /api/spine/parse/:id
with bearer auth. Scheduled via pg_cron every 5 minutes. Ensures
captures from non-Claude-session sources (dashboard bar, mobile)
get turned into structured data within minutes of capture.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Deploy signal scan edge function (daily 7am)

**Files:**
- Create: `supabase/functions/spine-signal-scan/index.ts`

- [ ] **Step 1: Write the signal scan function**

```typescript
// supabase/functions/spine-signal-scan/index.ts
// Daily scan that writes signals for stale contacts, closing_soon
// opportunities, and upcoming birthdays. Runs at 7am MST (14:00 UTC).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const now = new Date();
  const nowISO = now.toISOString();
  const in7days = new Date(now.getTime() + 7 * 86400 * 1000).toISOString();

  let totalInserted = 0;

  // ---- STALE signals ----
  const { data: staleRows } = await supabase
    .from("cycle_state")
    .select("contact_id, user_id, next_due_at")
    .eq("status", "active")
    .lt("next_due_at", nowISO);

  for (const r of staleRows ?? []) {
    // Skip if an active stale signal already exists for this contact.
    const { data: existing } = await supabase
      .from("signals")
      .select("id")
      .eq("contact_id", r.contact_id)
      .eq("kind", "stale")
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();
    if (existing) continue;

    await supabase.from("signals").insert({
      user_id: r.user_id,
      contact_id: r.contact_id,
      kind: "stale",
      severity: "normal",
      title: "Contact has gone stale",
      detail: `next_due_at was ${r.next_due_at}`,
      window_start: nowISO,
      window_end: in7days,
      suggested_action: "Reach out with a check-in",
    });
    totalInserted++;
  }

  // ---- CLOSING_SOON signals ----
  // Assumes opportunities table has closing_date and a link to contacts.
  const { data: closingRows } = await supabase
    .from("opportunities")
    .select("id, user_id, contact_id, escrow_number, closing_date, sale_price")
    .gte("closing_date", nowISO)
    .lte("closing_date", in7days);

  for (const r of closingRows ?? []) {
    const { data: existing } = await supabase
      .from("signals")
      .select("id")
      .eq("opportunity_id", r.id)
      .eq("kind", "closing_soon")
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();
    if (existing) continue;

    await supabase.from("signals").insert({
      user_id: r.user_id,
      contact_id: r.contact_id,
      opportunity_id: r.id,
      kind: "closing_soon",
      severity: "high",
      title: `Closing ${new Date(r.closing_date).toLocaleDateString()}`,
      detail: r.escrow_number ? `Escrow ${r.escrow_number}` : null,
      window_start: nowISO,
      window_end: r.closing_date,
      suggested_action: "Send closing gift and congrats note",
    });
    totalInserted++;
  }

  // ---- EXPIRE old signals ----
  await supabase
    .from("signals")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("window_end", nowISO);

  return new Response(
    JSON.stringify({ inserted: totalInserted }),
    { headers: { "Content-Type": "application/json" } }
  );
});
```

- [ ] **Step 2: Deploy and schedule**

```bash
cd ~/crm && pnpm dlx supabase functions deploy spine-signal-scan --no-verify-jwt
```

Expected: deploy success.

Schedule via SQL:
```sql
select cron.schedule(
  'spine-signal-scan-daily',
  '0 14 * * *',  -- 14:00 UTC = 7am MST
  $$
    select net.http_post(
      url := 'https://<project-ref>.functions.supabase.co/spine-signal-scan',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      )
    );
  $$
);
```

- [ ] **Step 3: Manually invoke to verify**

```bash
curl -X POST https://<project-ref>.functions.supabase.co/spine-signal-scan \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: JSON `{ inserted: N }`.

Verify rows via SQL:
```sql
select kind, count(*) from public.signals where status='active' group by kind;
```

Expected: at least some stale or closing_soon signals (depending on existing data).

- [ ] **Step 4: Commit**

```bash
cd ~/crm
git add supabase/functions/spine-signal-scan
git commit -m "$(cat <<'EOF'
feat(spine): daily signal scan edge function

Detects stale contacts (cycle_state next_due_at < now) and closing_soon
opportunities (closing_date within 7 days), writes to signals table
with dedup guard. Also expires signals past window_end. Scheduled for
14:00 UTC (7am MST) via pg_cron.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Deploy Monday rotation build edge function

**Files:**
- Create: `supabase/functions/spine-rotation-build/index.ts`

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/spine-rotation-build/index.ts
// Monday 6am MST (13:00 UTC) cron. Builds the week's focus_queue
// for every user based on signals, overdue commitments, due cadence,
// and manual adds rolled over from last week.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function currentMondayISO(d = new Date()): string {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const weekOf = currentMondayISO();
  const now = new Date().toISOString();

  // Get unique user_ids from cycle_state
  const { data: users } = await supabase
    .from("cycle_state")
    .select("user_id")
    .eq("status", "active");

  const userIds = Array.from(new Set((users ?? []).map((r: { user_id: string }) => r.user_id)));

  let totalInserted = 0;

  for (const userId of userIds) {
    // ----- Build candidate set -----
    type Candidate = {
      contact_id: string;
      priority: number;
      reason: string;
      reason_detail: string;
      suggested_action: string | null;
    };
    const candidates: Candidate[] = [];

    // Urgent signals -> priority 1
    const { data: urgentSignals } = await supabase
      .from("signals")
      .select("contact_id, title, suggested_action")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("severity", "urgent")
      .not("contact_id", "is", null)
      .is("deleted_at", null);
    for (const s of urgentSignals ?? []) {
      candidates.push({
        contact_id: s.contact_id,
        priority: 1,
        reason: "signal",
        reason_detail: s.title,
        suggested_action: s.suggested_action,
      });
    }

    // Overdue commitments -> priority 2
    const { data: overdue } = await supabase
      .from("commitments")
      .select("contact_id, title")
      .eq("user_id", userId)
      .eq("status", "open")
      .lt("due_at", now)
      .not("contact_id", "is", null)
      .is("deleted_at", null);
    for (const c of overdue ?? []) {
      candidates.push({
        contact_id: c.contact_id,
        priority: 2,
        reason: "commitment",
        reason_detail: `Overdue: ${c.title}`,
        suggested_action: "Deliver or drop",
      });
    }

    // High signals -> priority 3
    const { data: highSignals } = await supabase
      .from("signals")
      .select("contact_id, title, suggested_action")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("severity", "high")
      .not("contact_id", "is", null)
      .is("deleted_at", null);
    for (const s of highSignals ?? []) {
      candidates.push({
        contact_id: s.contact_id,
        priority: 3,
        reason: "signal",
        reason_detail: s.title,
        suggested_action: s.suggested_action,
      });
    }

    // Due cadence -> priority 4
    const weekEndISO = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
    const { data: dueCadence } = await supabase
      .from("cycle_state")
      .select("contact_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .lt("next_due_at", weekEndISO);
    for (const c of dueCadence ?? []) {
      candidates.push({
        contact_id: c.contact_id,
        priority: 4,
        reason: "cadence",
        reason_detail: "Cycle due this week",
        suggested_action: null,
      });
    }

    // Dedup by contact_id, keep best priority
    const byContact = new Map<string, Candidate>();
    for (const c of candidates) {
      const existing = byContact.get(c.contact_id);
      if (!existing || c.priority < existing.priority) {
        byContact.set(c.contact_id, c);
      }
    }

    // Take top 10 by priority
    const ranked = Array.from(byContact.values())
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 10);

    // Insert. Use upsert so re-running on the same week doesn't dupe.
    for (let i = 0; i < ranked.length; i++) {
      const r = ranked[i];
      const { error } = await supabase
        .from("focus_queue")
        .upsert(
          {
            user_id: userId,
            contact_id: r.contact_id,
            week_of: weekOf,
            rank: i + 1,
            reason: r.reason as "signal" | "cadence" | "manual" | "commitment",
            reason_detail: r.reason_detail,
            suggested_action: r.suggested_action,
            status: "pending",
          },
          { onConflict: "user_id,contact_id,week_of" }
        );
      if (!error) totalInserted++;
    }
  }

  return new Response(
    JSON.stringify({ inserted: totalInserted, users: userIds.length, week_of: weekOf }),
    { headers: { "Content-Type": "application/json" } }
  );
});
```

- [ ] **Step 2: Deploy and schedule**

```bash
cd ~/crm && pnpm dlx supabase functions deploy spine-rotation-build --no-verify-jwt
```

Schedule SQL:
```sql
select cron.schedule(
  'spine-rotation-build-monday',
  '0 13 * * 1',  -- Monday 13:00 UTC = 6am MST
  $$
    select net.http_post(
      url := 'https://<project-ref>.functions.supabase.co/spine-rotation-build',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      )
    );
  $$
);
```

- [ ] **Step 3: Manually invoke to seed the current week**

```bash
curl -X POST https://<project-ref>.functions.supabase.co/spine-rotation-build \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: `{ inserted: N, users: M, week_of: "YYYY-MM-DD" }`.

Verify:
```sql
select count(*) from public.focus_queue
where week_of = (current_date - extract(isodow from current_date)::int + 1);
```

- [ ] **Step 4: Commit**

```bash
cd ~/crm
git add supabase/functions/spine-rotation-build
git commit -m "$(cat <<'EOF'
feat(spine): Monday rotation build edge function

Builds weekly focus_queue from urgent signals, overdue commitments,
high signals, and due cadence in priority order. Top 10 per user.
Upserts with unique(user_id, contact_id, week_of) so re-runs are safe.
Scheduled Monday 13:00 UTC (6am MST).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Seed cycle_state for existing Tier 1+2 contacts

**Files:**
- Create: `supabase/migrations/20260407030000_spine_seed_cycle_state.sql`

- [ ] **Step 1: Write the seed migration**

```sql
-- supabase/migrations/20260407030000_spine_seed_cycle_state.sql
-- One-time seed: create cycle_state rows for every Tier 1 and Tier 2
-- contact that does not already have one. Uses tier-default cadence.
-- Per spec open question 1: Tier 1+2 auto, Tier 3 opt-in.

insert into public.cycle_state (contact_id, user_id, cadence_days, last_touched_at, next_due_at, status)
select
  c.id,
  c.user_id,
  case
    when c.tier in ('1','tier1') then 7
    when c.tier in ('2','tier2') then 14
    else null
  end,
  null,
  now() + interval '1 day',  -- start as due-soon so first rotation picks them up
  'active'
from public.contacts c
left join public.cycle_state cs on cs.contact_id = c.id
where c.deleted_at is null
  and c.tier in ('1','2','tier1','tier2')
  and cs.contact_id is null;
```

- [ ] **Step 2: Apply migration and verify**

```bash
cd ~/crm && pnpm dlx supabase db push --include-all
```

Verify:
```sql
select status, count(*) from public.cycle_state group by status;
select c.tier, count(*)
from public.cycle_state cs
join public.contacts c on c.id = cs.contact_id
group by c.tier;
```

Expected: `cycle_state` count matches your Tier 1+2 contact count.

- [ ] **Step 3: Commit**

```bash
cd ~/crm
git add supabase/migrations/20260407030000_spine_seed_cycle_state.sql
git commit -m "$(cat <<'EOF'
feat(spine): seed cycle_state for Tier 1+2 contacts

One-time idempotent seed that inserts cycle_state rows with tier
default cadence (T1=7d, T2=14d) for every contact that doesn't
already have one. Tier 3 is opt-in per spec open question 1.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## MILESTONE A: Backend Complete

Stop here. Before moving to the UI, confirm:

- [ ] `GET /api/spine/today` returns a valid (possibly empty) payload when signed in
- [ ] `POST /api/spine/capture` writes to spine_inbox
- [ ] Parser edge function processes captures within 5 min
- [ ] `POST /api/spine/commitments` round-trips correctly
- [ ] Signal scan + rotation build crons both deploy and run
- [ ] `cycle_state` is seeded for Tier 1+2
- [ ] No TypeScript errors (`pnpm exec tsc --noEmit` shows no new errors)
- [ ] No new ESLint errors (`pnpm lint` shows no new errors)

Request review from Alex before proceeding to Part D.

---

# PART D -- TODAY COMMAND UI

## Task 17: Page shell + TanStack Query hook

**Files:**
- Create: `src/app/(app)/dashboard/today/page.tsx`
- Create: `src/app/(app)/dashboard/today/query.ts`

- [ ] **Step 1: Write the query hook**

```typescript
// src/app/(app)/dashboard/today/query.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { TodayPayloadT } from "@/lib/spine/types";

export function useTodayPayload() {
  return useQuery<TodayPayloadT>({
    queryKey: ["spine", "today"],
    queryFn: async () => {
      const res = await fetch("/api/spine/today", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load today: ${res.status}`);
      return res.json();
    },
    staleTime: 30 * 1000, // 30s per dashboard.md task card default
    refetchOnWindowFocus: true,
  });
}
```

- [ ] **Step 2: Write the page**

```typescript
// src/app/(app)/dashboard/today/page.tsx
import { TodayCommand } from "./client";

export default function TodayPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <h1 className="sr-only">Today Command</h1>
      <TodayCommand />
    </main>
  );
}
```

- [ ] **Step 3: Write the client component shell**

```typescript
// src/app/(app)/dashboard/today/client.tsx
"use client";

import { useTodayPayload } from "./query";
import { TodayFocusCard } from "@/components/today/TodayFocusCard";
import { ComingDueCard } from "@/components/today/ComingDueCard";
import { WeekRotationCard } from "@/components/today/WeekRotationCard";
import { OverdueCommitmentsCard } from "@/components/today/OverdueCommitmentsCard";
import { HighSignalsCard } from "@/components/today/HighSignalsCard";
import { RecentCapturesCard } from "@/components/today/RecentCapturesCard";
import { ContentCalendarCard } from "@/components/today/ContentCalendarCard";
import { CaptureBar } from "@/components/today/CaptureBar";

export function TodayCommand() {
  const { data, isLoading, error } = useTodayPayload();

  if (isLoading) {
    return (
      <div className="p-8 text-muted-foreground" aria-live="polite">
        Loading Today Command...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-destructive" role="alert">
        Failed to load: {error?.message ?? "unknown error"}
      </div>
    );
  }

  return (
    <>
      <div
        className="mx-auto max-w-[1400px] p-6 pb-24"
        style={{
          display: "grid",
          gap: "1.5rem",
          gridTemplateAreas: `
            "focus focus focus sidebar"
            "focus focus focus sidebar"
            "overdue overdue signals signals"
            "captures captures captures calendar"
          `,
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
        }}
      >
        <div style={{ gridArea: "focus" }}>
          <TodayFocusCard rows={data.today_focus} />
        </div>
        <div
          style={{ gridArea: "sidebar", display: "grid", gridTemplateRows: "1fr 1fr", gap: "1.5rem" }}
        >
          <ComingDueCard rows={data.coming_due} />
          <WeekRotationCard summary={data.week_rotation_summary} />
        </div>
        <div style={{ gridArea: "overdue" }}>
          <OverdueCommitmentsCard rows={data.overdue_commitments} />
        </div>
        <div style={{ gridArea: "signals" }}>
          <HighSignalsCard rows={data.high_signals} />
        </div>
        <div style={{ gridArea: "captures" }}>
          <RecentCapturesCard rows={data.recent_captures} />
        </div>
        <div style={{ gridArea: "calendar" }}>
          <ContentCalendarCard rows={data.content_calendar} />
        </div>
      </div>
      <CaptureBar />
    </>
  );
}
```

- [ ] **Step 4: Create placeholder card components so the page compiles**

Create each card file with a minimal placeholder. Task 18-24 will flesh them out.

```typescript
// src/components/today/TodayFocusCard.tsx
import type { TodayPayloadT } from "@/lib/spine/types";
export function TodayFocusCard({ rows }: { rows: TodayPayloadT["today_focus"] }) {
  return <section aria-label="Today's Focus" className="rounded-lg border border-border bg-card p-6">
    <h2 className="font-display text-xl font-semibold">Today's Focus</h2>
    <p className="text-muted-foreground">{rows.length} people</p>
  </section>;
}
```

```typescript
// src/components/today/ComingDueCard.tsx
import type { TodayPayloadT } from "@/lib/spine/types";
export function ComingDueCard({ rows }: { rows: TodayPayloadT["coming_due"] }) {
  return <section aria-label="Coming Due" className="rounded-lg border border-border bg-card p-6">
    <h2 className="text-sm font-semibold uppercase tracking-wider">Coming Due</h2>
    <p className="font-mono text-3xl">{rows.length}</p>
  </section>;
}
```

```typescript
// src/components/today/WeekRotationCard.tsx
import type { TodayPayloadT } from "@/lib/spine/types";
export function WeekRotationCard({ summary }: { summary: TodayPayloadT["week_rotation_summary"] }) {
  return <section aria-label="This Week Rotation" className="rounded-lg border border-border bg-card p-6">
    <h2 className="text-sm font-semibold uppercase tracking-wider">This Week</h2>
    <p className="font-mono text-3xl">{summary.pending}/{summary.total}</p>
  </section>;
}
```

```typescript
// src/components/today/OverdueCommitmentsCard.tsx
import type { TodayPayloadT } from "@/lib/spine/types";
export function OverdueCommitmentsCard({ rows }: { rows: TodayPayloadT["overdue_commitments"] }) {
  return <section aria-label="Overdue Commitments" className="rounded-lg border border-border bg-card p-6">
    <h2 className="font-display text-lg font-semibold">Overdue Commitments</h2>
    <p className="text-muted-foreground">{rows.length} open</p>
  </section>;
}
```

```typescript
// src/components/today/HighSignalsCard.tsx
import type { TodayPayloadT } from "@/lib/spine/types";
export function HighSignalsCard({ rows }: { rows: TodayPayloadT["high_signals"] }) {
  return <section aria-label="High Signals" className="rounded-lg border border-border bg-card p-6">
    <h2 className="font-display text-lg font-semibold">High Signals</h2>
    <p className="text-muted-foreground">{rows.length} active</p>
  </section>;
}
```

```typescript
// src/components/today/RecentCapturesCard.tsx
import type { TodayPayloadT } from "@/lib/spine/types";
export function RecentCapturesCard({ rows }: { rows: TodayPayloadT["recent_captures"] }) {
  return <section aria-label="Recent Captures" className="rounded-lg border border-border bg-card p-6">
    <h2 className="font-display text-lg font-semibold">Recent Captures</h2>
    <ul>{rows.map(r => <li key={r.id} className="text-sm">{r.raw_text.slice(0, 60)}</li>)}</ul>
  </section>;
}
```

```typescript
// src/components/today/ContentCalendarCard.tsx
import type { TodayPayloadT } from "@/lib/spine/types";
export function ContentCalendarCard({ rows }: { rows: TodayPayloadT["content_calendar"] }) {
  return <section aria-label="Content Calendar" className="rounded-lg border border-border bg-card p-6">
    <h2 className="text-sm font-semibold uppercase tracking-wider">Content</h2>
    <p className="text-muted-foreground">{rows.length} scheduled</p>
  </section>;
}
```

```typescript
// src/components/today/CaptureBar.tsx
"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function CaptureBar() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/spine/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: text, source: "dashboard_bar" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setText("");
      qc.invalidateQueries({ queryKey: ["spine", "today"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 p-4 backdrop-blur"
      aria-label="Capture bar"
    >
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Capture anything... met X warm, needs Y by Friday"
        className="w-full rounded-md border border-border bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-white/[0.12] focus:outline-none"
        aria-label="Capture text input"
        disabled={busy}
      />
    </form>
  );
}
```

- [ ] **Step 5: Verify compile, run dev server, browse page**

```bash
cd ~/crm && pnpm exec tsc --noEmit && pnpm dev
```

Navigate to `http://localhost:3000/dashboard/today` (signed in). Expected: page renders with 7 placeholder cards and a capture bar at the bottom. No console errors.

- [ ] **Step 6: Commit**

```bash
cd ~/crm
git add src/app/\(app\)/dashboard/today src/components/today
git commit -m "$(cat <<'EOF'
feat(spine): Today Command page shell with 7-card grid

/dashboard/today renders the full bento layout with placeholder cards,
TanStack Query hook against /api/spine/today, and always-on capture
bar at the bottom. Real card contents arrive in Tasks 18-23.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Flesh out Today's Focus card with quick actions

**Files:**
- Modify: `src/components/today/TodayFocusCard.tsx`

- [ ] **Step 1: Replace the placeholder with the real card**

```typescript
// src/components/today/TodayFocusCard.tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TodayPayloadT } from "@/lib/spine/types";

type FocusRow = TodayPayloadT["today_focus"][number];

async function patchFocus(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/spine/focus/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
  return res.json();
}

function FocusRowItem({ row }: { row: FocusRow }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function action(update: Record<string, unknown>) {
    setBusy(true);
    try {
      await patchFocus(row.focus.id, update);
      qc.invalidateQueries({ queryKey: ["spine", "today"] });
    } finally {
      setBusy(false);
    }
  }

  const { contact, focus } = row;
  const name = `${contact.first_name} ${contact.last_name}`;

  return (
    <li
      className="flex items-start gap-4 rounded-md border border-border/50 p-4 transition-colors hover:border-white/[0.12]"
    >
      {contact.avatar_url ? (
        <img
          src={contact.avatar_url}
          alt=""
          className="h-12 w-12 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-semibold">
          {contact.first_name[0]}{contact.last_name[0]}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="font-semibold">{name}</div>
        <div className="text-sm text-muted-foreground">
          {focus.reason_detail ?? focus.reason ?? "Focus"}
        </div>
        {focus.suggested_action && (
          <div className="mt-1 text-sm italic text-muted-foreground">
            {focus.suggested_action}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => action({ status: "touched", touched_via: "call", outcome: "warm" })}
          disabled={busy}
          aria-label={`Mark ${name} as touched`}
          className="min-h-[44px] min-w-[44px] rounded-md border border-border px-3 text-sm hover:border-white/[0.12]"
        >
          Touched
        </button>
        <button
          type="button"
          onClick={() => action({ status: "deferred" })}
          disabled={busy}
          aria-label={`Defer ${name}`}
          className="min-h-[44px] min-w-[44px] rounded-md border border-border px-3 text-sm hover:border-white/[0.12]"
        >
          Defer
        </button>
        <button
          type="button"
          onClick={() => action({ status: "skipped" })}
          disabled={busy}
          aria-label={`Skip ${name}`}
          className="min-h-[44px] min-w-[44px] rounded-md border border-border px-3 text-sm hover:border-white/[0.12]"
        >
          Skip
        </button>
      </div>
    </li>
  );
}

export function TodayFocusCard({ rows }: { rows: TodayPayloadT["today_focus"] }) {
  return (
    <section
      aria-label="Today's Focus"
      aria-live="polite"
      className="rounded-lg border border-border bg-card p-6"
    >
      <div className="mb-4">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          TODAY
        </span>
        <h2 className="font-display text-3xl font-semibold">Today's Focus</h2>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing on the queue right now. Enjoy the quiet.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map(row => (
            <FocusRowItem key={row.focus.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify compile and visual render**

```bash
cd ~/crm && pnpm exec tsc --noEmit && pnpm dev
```

Navigate to `/dashboard/today`. If you have no focus data yet, create one via browser console (Task 10 Step 3 pattern). Expected: the card shows the row with Touched/Defer/Skip buttons. Clicking Touched invalidates the query and the row disappears.

- [ ] **Step 3: Commit**

```bash
cd ~/crm
git add src/components/today/TodayFocusCard.tsx
git commit -m "$(cat <<'EOF'
feat(spine): real Today's Focus card with quick actions

Shows avatar, name, reason, suggested action, plus three 44x44px
touch targets for Touched/Defer/Skip. PATCHes /api/spine/focus/:id
and invalidates the today query on success. Falls through to cycle
state via the interactions trigger chain.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: Overdue Commitments card with quick actions

**Files:**
- Modify: `src/components/today/OverdueCommitmentsCard.tsx`

- [ ] **Step 1: Replace placeholder**

```typescript
// src/components/today/OverdueCommitmentsCard.tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TodayPayloadT } from "@/lib/spine/types";

type CommitRow = TodayPayloadT["overdue_commitments"][number];

async function patchCommit(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/spine/commitments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

function daysOverdue(dueAt: string | null): number {
  if (!dueAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dueAt).getTime()) / 86400000));
}

function CommitItem({ row }: { row: CommitRow }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function action(update: Record<string, unknown>) {
    setBusy(true);
    try {
      await patchCommit(row.id, update);
      qc.invalidateQueries({ queryKey: ["spine", "today"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium">{row.title}</div>
        <div className="text-xs text-muted-foreground">
          <span className="font-mono">{daysOverdue(row.due_at)}d</span> overdue
          {row.kind && ` · ${row.kind}`}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => action({ status: "delivered", delivered_at: new Date().toISOString() })}
          disabled={busy}
          aria-label={`Mark ${row.title} delivered`}
          className="min-h-[44px] rounded-md border border-border px-3 text-xs hover:border-white/[0.12]"
        >
          Delivered
        </button>
        <button
          type="button"
          onClick={() => action({ status: "dropped" })}
          disabled={busy}
          aria-label={`Drop ${row.title}`}
          className="min-h-[44px] rounded-md border border-border px-3 text-xs hover:border-white/[0.12]"
        >
          Drop
        </button>
      </div>
    </li>
  );
}

export function OverdueCommitmentsCard({
  rows,
}: {
  rows: TodayPayloadT["overdue_commitments"];
}) {
  return (
    <section
      aria-label="Overdue Commitments"
      className="rounded-lg border border-border bg-card p-6"
    >
      <div className="mb-3">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          OVERDUE
        </span>
        <h2 className="font-display text-xl font-semibold">Commitments</h2>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Clean slate.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map(row => (
            <CommitItem key={row.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify and commit**

```bash
cd ~/crm && pnpm exec tsc --noEmit && pnpm dev
```

Navigate to `/dashboard/today`. If you have an overdue commitment, the card should render it with Delivered/Drop buttons. Clicking either invalidates and the row disappears.

```bash
git add src/components/today/OverdueCommitmentsCard.tsx
git commit -m "$(cat <<'EOF'
feat(spine): Overdue Commitments card with quick actions

Lists open commitments past due_at, shows days overdue in Space Mono,
exposes Delivered/Drop 44px buttons. On delivered, sets delivered_at
to now. Invalidates today query on action success.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: High Signals card with quick actions

**Files:**
- Modify: `src/components/today/HighSignalsCard.tsx`

- [ ] **Step 1: Replace placeholder**

```typescript
// src/components/today/HighSignalsCard.tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TodayPayloadT } from "@/lib/spine/types";

type SigRow = TodayPayloadT["high_signals"][number];

async function patchSignal(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/spine/signals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

function SigItem({ row }: { row: SigRow }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function action(status: "acted_on" | "dismissed") {
    setBusy(true);
    try {
      await patchSignal(row.id, { status });
      qc.invalidateQueries({ queryKey: ["spine", "today"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              row.severity === "urgent" ? "bg-destructive" : "bg-accent"
            }`}
            aria-hidden="true"
          />
          <span className="font-medium">{row.title}</span>
        </div>
        {row.detail && (
          <div className="mt-1 text-xs text-muted-foreground">{row.detail}</div>
        )}
        {row.suggested_action && (
          <div className="mt-1 text-xs italic text-muted-foreground">
            → {row.suggested_action}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => action("acted_on")}
          disabled={busy}
          aria-label={`Mark ${row.title} acted on`}
          className="min-h-[44px] rounded-md border border-border px-3 text-xs hover:border-white/[0.12]"
        >
          Acted
        </button>
        <button
          type="button"
          onClick={() => action("dismissed")}
          disabled={busy}
          aria-label={`Dismiss ${row.title}`}
          className="min-h-[44px] rounded-md border border-border px-3 text-xs hover:border-white/[0.12]"
        >
          Dismiss
        </button>
      </div>
    </li>
  );
}

export function HighSignalsCard({ rows }: { rows: TodayPayloadT["high_signals"] }) {
  return (
    <section
      aria-label="High Signals"
      className="rounded-lg border border-border bg-card p-6"
    >
      <div className="mb-3">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          SIGNALS
        </span>
        <h2 className="font-display text-xl font-semibold">High & Urgent</h2>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No high-severity signals right now.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map(row => (
            <SigItem key={row.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify and commit**

```bash
cd ~/crm && pnpm exec tsc --noEmit
git add src/components/today/HighSignalsCard.tsx
git commit -m "$(cat <<'EOF'
feat(spine): High Signals card with Acted/Dismiss actions

Shows severity dot (red urgent, accent high), title, detail, suggested
action. Quick actions PATCH /api/spine/signals/:id to acted_on or
dismissed. Auto-stamps acted_on_at on the backend.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 21: Coming Due, Week Rotation, Recent Captures, Content Calendar cards

These four cards are read-only for Phase 1. Fill them in together.

**Files:**
- Modify: `src/components/today/ComingDueCard.tsx`
- Modify: `src/components/today/WeekRotationCard.tsx`
- Modify: `src/components/today/RecentCapturesCard.tsx`
- Modify: `src/components/today/ContentCalendarCard.tsx`

- [ ] **Step 1: Coming Due**

```typescript
// src/components/today/ComingDueCard.tsx
import type { TodayPayloadT } from "@/lib/spine/types";

export function ComingDueCard({ rows }: { rows: TodayPayloadT["coming_due"] }) {
  return (
    <section
      aria-label="Coming Due"
      className="rounded-lg border border-border bg-card p-6"
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Coming Due (48h)
      </h2>
      <p className="mt-2 font-mono text-4xl font-medium">{rows.length}</p>
      {rows.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {rows.slice(0, 3).map(r => (
            <li key={r.cycle.contact_id} className="truncate text-muted-foreground">
              {r.contact.first_name} {r.contact.last_name}
            </li>
          ))}
          {rows.length > 3 && (
            <li className="text-xs text-muted-foreground">+{rows.length - 3} more</li>
          )}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Week Rotation**

```typescript
// src/components/today/WeekRotationCard.tsx
import type { TodayPayloadT } from "@/lib/spine/types";

export function WeekRotationCard({
  summary,
}: {
  summary: TodayPayloadT["week_rotation_summary"];
}) {
  return (
    <section
      aria-label="This Week Rotation"
      className="rounded-lg border border-border bg-card p-6"
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        This Week
      </h2>
      <p className="mt-2 font-mono text-4xl font-medium">
        {summary.pending}
        <span className="text-2xl text-muted-foreground">/{summary.total}</span>
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="font-mono text-sm">{summary.touched}</div>
          <div className="text-muted-foreground">Touched</div>
        </div>
        <div>
          <div className="font-mono text-sm">{summary.skipped}</div>
          <div className="text-muted-foreground">Skipped</div>
        </div>
        <div>
          <div className="font-mono text-sm">{summary.deferred}</div>
          <div className="text-muted-foreground">Deferred</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Recent Captures**

```typescript
// src/components/today/RecentCapturesCard.tsx
import type { TodayPayloadT } from "@/lib/spine/types";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export function RecentCapturesCard({
  rows,
}: {
  rows: TodayPayloadT["recent_captures"];
}) {
  return (
    <section
      aria-label="Recent Captures"
      className="rounded-lg border border-border bg-card p-6"
    >
      <h2 className="mb-4 font-display text-xl font-semibold">Recent Captures</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No captures yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map(r => (
            <li key={r.id} className="flex items-start gap-3 text-sm">
              <span
                className={`mt-1 inline-block h-2 w-2 rounded-full ${
                  r.parsed ? "bg-green-500" : "bg-yellow-500"
                }`}
                aria-hidden="true"
                title={r.parsed ? "parsed" : "pending parse"}
              />
              <div className="flex-1 min-w-0">
                <div className="truncate text-foreground">{r.raw_text}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-mono">{relativeTime(r.captured_at)}</span> ago
                  {" · "}
                  {r.source}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Content Calendar**

```typescript
// src/components/today/ContentCalendarCard.tsx
import type { TodayPayloadT } from "@/lib/spine/types";

export function ContentCalendarCard({
  rows,
}: {
  rows: TodayPayloadT["content_calendar"];
}) {
  return (
    <section
      aria-label="Content Calendar"
      className="rounded-lg border border-border bg-card p-6"
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Content
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Phase 5 populates this card.
        </p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {rows.slice(0, 2).map((r, i) => (
            <li key={i}>
              <div className="font-medium">{r.title}</div>
              <div className="font-mono text-xs text-muted-foreground">
                {new Date(r.scheduled_for).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Verify compile and browse all cards**

```bash
cd ~/crm && pnpm exec tsc --noEmit && pnpm dev
```

Navigate to `/dashboard/today`. All 7 cards should render without errors. Cards with no data show their empty states.

- [ ] **Step 6: Commit**

```bash
cd ~/crm
git add src/components/today
git commit -m "$(cat <<'EOF'
feat(spine): fill Coming Due, Week Rotation, Captures, Content cards

Four read-only cards. Numbers use Space Mono per digital-aesthetic.
Captures shows parsed status dot. Content Calendar is placeholder
noting Phase 5 integration.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 22: Responsive grid for tablet and mobile

**Files:**
- Modify: `src/app/(app)/dashboard/today/client.tsx`

- [ ] **Step 1: Replace the inline grid style with Tailwind classes that collapse**

```typescript
// src/app/(app)/dashboard/today/client.tsx
"use client";

import { useTodayPayload } from "./query";
import { TodayFocusCard } from "@/components/today/TodayFocusCard";
import { ComingDueCard } from "@/components/today/ComingDueCard";
import { WeekRotationCard } from "@/components/today/WeekRotationCard";
import { OverdueCommitmentsCard } from "@/components/today/OverdueCommitmentsCard";
import { HighSignalsCard } from "@/components/today/HighSignalsCard";
import { RecentCapturesCard } from "@/components/today/RecentCapturesCard";
import { ContentCalendarCard } from "@/components/today/ContentCalendarCard";
import { CaptureBar } from "@/components/today/CaptureBar";

export function TodayCommand() {
  const { data, isLoading, error } = useTodayPayload();

  if (isLoading) {
    return (
      <div className="p-8 text-muted-foreground" aria-live="polite">
        Loading Today Command...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-destructive" role="alert">
        Failed to load: {error?.message ?? "unknown error"}
      </div>
    );
  }

  return (
    <>
      <a href="#today-focus" className="sr-only focus:not-sr-only">Skip to Today's Focus</a>
      <a href="#capture-bar" className="sr-only focus:not-sr-only">Skip to capture bar</a>

      <div className="mx-auto max-w-[1400px] p-6 pb-28">
        {/* Mobile-first: stack. Tablet: 2-col. Desktop: bento. */}
        <div
          className="grid gap-6
            grid-cols-1
            md:grid-cols-2
            lg:grid-cols-4"
        >
          {/* Today's Focus -- hero, takes 2 rows on desktop */}
          <div id="today-focus" className="lg:col-span-3 lg:row-span-2">
            <TodayFocusCard rows={data.today_focus} />
          </div>

          {/* Sidebar compacts */}
          <div className="lg:col-span-1">
            <ComingDueCard rows={data.coming_due} />
          </div>
          <div className="lg:col-span-1">
            <WeekRotationCard summary={data.week_rotation_summary} />
          </div>

          {/* Overdue + Signals row */}
          <div className="lg:col-span-2">
            <OverdueCommitmentsCard rows={data.overdue_commitments} />
          </div>
          <div className="lg:col-span-2">
            <HighSignalsCard rows={data.high_signals} />
          </div>

          {/* Captures + Calendar row */}
          <div className="lg:col-span-3">
            <RecentCapturesCard rows={data.recent_captures} />
          </div>
          <div className="lg:col-span-1">
            <ContentCalendarCard rows={data.content_calendar} />
          </div>
        </div>
      </div>

      <CaptureBar />
    </>
  );
}
```

- [ ] **Step 2: Verify at three widths**

```bash
cd ~/crm && pnpm dev
```

Open `/dashboard/today`. In Chrome DevTools, test at widths: 375px (mobile), 768px (tablet), 1400px (desktop). Each width should render all 7 cards with no overflow.

Use playwright-cli to capture screenshots:
```bash
pnpm dlx playwright screenshot --full-page --viewport-size=1400,900 http://localhost:3000/dashboard/today /tmp/today-desktop.png
pnpm dlx playwright screenshot --full-page --viewport-size=768,1024 http://localhost:3000/dashboard/today /tmp/today-tablet.png
pnpm dlx playwright screenshot --full-page --viewport-size=375,812 http://localhost:3000/dashboard/today /tmp/today-mobile.png
```

(If playwright isn't installed, skip the screenshot step and verify visually in browser DevTools.)

Expected: all 3 screenshots show a usable layout. Focus card is prominent at every width.

- [ ] **Step 3: Commit**

```bash
cd ~/crm
git add src/app/\(app\)/dashboard/today/client.tsx
git commit -m "$(cat <<'EOF'
feat(spine): responsive grid for Today Command

Mobile-first stack, tablet 2-col, desktop 4-col with hero focus card
spanning 3 cols x 2 rows. Adds skip links for a11y. Today's Focus
remains the prominent element at every width.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 23: Supabase Realtime subscription

**Files:**
- Modify: `src/app/(app)/dashboard/today/client.tsx`

- [ ] **Step 1: Add realtime subscription to invalidate query on any spine table write**

Insert the realtime effect near the top of `TodayCommand` after the `useTodayPayload` call:

```typescript
// src/app/(app)/dashboard/today/client.tsx
"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useTodayPayload } from "./query";
// ... rest of imports unchanged

export function TodayCommand() {
  const { data, isLoading, error } = useTodayPayload();
  const qc = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const tables = ["commitments", "focus_queue", "signals", "spine_inbox", "cycle_state"];
    const channel = supabase.channel("spine-today");

    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          qc.invalidateQueries({ queryKey: ["spine", "today"] });
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // ... rest of the function unchanged
```

Keep the rest of the component body exactly as it was in Task 22.

- [ ] **Step 2: Verify realtime works**

Dev server running, navigate to `/dashboard/today`. In a second browser tab, open the Supabase table editor and insert a row into `spine_inbox` manually. Expected: the Recent Captures card on `/dashboard/today` updates within 1-2 seconds without a manual refresh.

Alternative: type something in the capture bar and watch Recent Captures populate after the next parser run.

- [ ] **Step 3: Commit**

```bash
cd ~/crm
git add src/app/\(app\)/dashboard/today/client.tsx
git commit -m "$(cat <<'EOF'
feat(spine): Supabase Realtime invalidation for Today Command

Subscribes to postgres_changes on all 5 spine tables. Any write
invalidates the today query and TanStack Query refetches. No direct
component state mutation from realtime events per dashboard.md rule.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 24: Accessibility pass

**Files:**
- Modify: `src/app/(app)/dashboard/today/client.tsx`
- Modify: `src/components/today/TodayFocusCard.tsx` (verify)
- Modify: `src/components/today/CaptureBar.tsx` (id for skip link)

- [ ] **Step 1: Add id targets for skip links and verify aria on every card**

In `CaptureBar.tsx`, add `id="capture-bar"` to the form element:

```typescript
// src/components/today/CaptureBar.tsx -- find the form element, add id
    <form
      id="capture-bar"
      onSubmit={submit}
      className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 p-4 backdrop-blur"
      aria-label="Capture bar"
    >
```

- [ ] **Step 2: Verify every card has aria-label**

Quick audit: open each file in `src/components/today/` and confirm the top-level `<section>` has `aria-label`. Every card in the plan already has this from its task, but run this check to catch any drift:

```bash
cd ~/crm
grep -L 'aria-label' src/components/today/*.tsx
```

Expected output: empty (no files missing aria-label). If any file is listed, add the aria-label to the top-level section element.

- [ ] **Step 3: Verify keyboard navigation**

Dev server, navigate to `/dashboard/today`. Tab through the page. Expected:
1. First tab lands on "Skip to Today's Focus" link (becomes visible on focus)
2. Second tab lands on "Skip to capture bar"
3. Then tabs through the Touched/Defer/Skip buttons in order
4. Finally tabs into the capture bar input

Each button should show a visible focus ring (`outline: 3px solid` at `outline-offset: 3px` per digital-aesthetic.md).

If focus rings are missing, add this to `~/crm/src/app/globals.css` inside `@layer base`:

```css
button:focus-visible,
a:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 3px solid var(--ring, #e63550);
  outline-offset: 3px;
}
```

- [ ] **Step 4: Verify prefers-reduced-motion is honored**

This should already be in `globals.css` per digital-aesthetic.md. If not, add:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Test by running `System Preferences > Accessibility > Display > Reduce motion` (macOS), or use Chrome DevTools `Rendering > Emulate CSS media feature prefers-reduced-motion: reduce`.

- [ ] **Step 5: Commit**

```bash
cd ~/crm
git add src/app/\(app\)/dashboard/today src/components/today src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(spine): accessibility pass on Today Command

Adds id=capture-bar for skip link target, confirms aria-label on
every card section, adds focus-visible outline rule, verifies
prefers-reduced-motion override. Meets dashboard.md Section 7 floor.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 25: End-to-end smoke test + milestone B sign-off

**Files:**
- Create: `docs/superpowers/plans/2026-04-07-spine-phase1-verification.md` (verification log)

- [ ] **Step 1: Start dev server and walk the full happy path**

```bash
cd ~/crm && pnpm dev
```

Sign in at `http://localhost:3000/login`, then navigate to `/dashboard/today`.

Walk this script end-to-end:

1. Page loads, renders all 7 cards (possibly with empty states)
2. In the capture bar, type: `Met with Julie today, warm, promised her Optima Camelview flyer by Friday`
3. Press Enter
4. Within 30 seconds (parser cron is 5 min -- for fast feedback hit `POST /api/spine/parse/:id` manually via browser console using the inbox id from Recent Captures)
5. Recent Captures card should show the entry with green "parsed" dot
6. Overdue Commitments card may or may not show a row (depends on parsed due_at -- "by Friday" is a relative phrase the parser currently returns as text, not a date)
7. If the parser detected Julie in your contacts and added her to focus_queue, Today's Focus now shows her
8. Click Touched on her row. The row disappears. Recent Captures card unchanged. Cycle state updated server-side.

- [ ] **Step 2: Verify server-side state after the walkthrough**

```sql
-- Should show the capture
select id, raw_text, parsed, parsed_commitment_ids, parsed_signal_ids
from public.spine_inbox
order by captured_at desc limit 5;

-- Should show the parsed commitment
select id, title, kind, source, status
from public.commitments
order by created_at desc limit 5;

-- If Julie was touched, her cycle_state should have recent last_touched_at
select contact_id, last_touched_at, next_due_at
from public.cycle_state
order by updated_at desc limit 5;
```

Expected: all three queries return rows matching what you did in the UI.

- [ ] **Step 3: Run full compile + lint**

```bash
cd ~/crm
pnpm exec tsc --noEmit
pnpm lint
```

Expected: zero new errors in either.

- [ ] **Step 4: Write verification log**

Create `docs/superpowers/plans/2026-04-07-spine-phase1-verification.md`:

```markdown
# Spine Phase 1 -- Verification Log

**Date completed:** [fill in]
**Executed by:** [fill in -- subagent or human]

## Smoke test results

- [ ] Capture bar writes to spine_inbox
- [ ] Parser processes inbox entry (inline or cron)
- [ ] Parsed commitment appears in Overdue or commitments list
- [ ] Parsed contact match shows up in Today's Focus (if match confidence high)
- [ ] Touched button creates interactions row
- [ ] cycle_state.last_touched_at advances on touched
- [ ] Realtime updates the UI without manual refresh

## Known limitations

- due_at parsing uses relative phrases ("by Friday"), not absolute dates. Follow-up: Phase 2 Claude Code spine skill can compute dates from context.
- Content calendar card is empty until Phase 5.
- Mobile `/capture` route not yet built (Phase 3).
- Learning loop not active yet (Phase 4).

## Outstanding open questions from spec section 11

Re-confirm with Alex before Phase 2:
- Dormant handling (spec OQ 2)
- Quarterly event drip integration (spec OQ 3)
- Auto-apply vs suggest for learning loop (spec OQ 4)
- Vacation snooze (spec OQ 6)
- Commitment attachments (spec OQ 7)
- Christine McConnell parser rules (spec OQ 8)

## Sign-off

- [ ] Alex opened /dashboard/today, used it, approved.
```

- [ ] **Step 5: Final commit**

```bash
cd ~/crm
git add docs/superpowers/plans/2026-04-07-spine-phase1-verification.md
git commit -m "$(cat <<'EOF'
docs(spine): Phase 1 verification log

Final milestone of Spine Phase 1. Walks the end-to-end happy path
(capture -> parse -> commitment -> focus -> touched -> cycle_state
update) and captures known limitations for Phases 2-5 handoff.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## MILESTONE B: Phase 1 Ship Ready

All 25 tasks complete. Next steps:

1. Alex reviews `/dashboard/today` in the browser
2. Alex uses the system for a work week
3. Gaps or friction get logged for Phase 2 planning
4. `superpowers:finishing-a-development-branch` to merge, PR, or close out the branch

---

# Plan Self-Review

## Spec coverage check

Against spec section 2 (data model):
- [x] commitments table -- Task 1
- [x] focus_queue table -- Task 1
- [x] cycle_state table -- Task 1
- [x] signals table -- Task 1
- [x] spine_inbox table -- Task 1
- [x] interactions trigger -- Task 2

Against spec section 3 (cycle engine):
- [x] Cadence layer (tier defaults 7/14/30) -- Task 2 trigger + Task 16 seed
- [x] Signal layer (daily scan) -- Task 14
- [x] Rotation layer (Monday build) -- Task 15
- [x] Content layer -- read-only placeholder, Task 21 (full Phase 5)

Against spec section 4 (Today Command UI):
- [x] /dashboard/today route -- Task 17
- [x] Bento grid with 7 cards -- Tasks 17, 22
- [x] Today's Focus hero with quick actions -- Task 18
- [x] Overdue Commitments card -- Task 19
- [x] High Signals card -- Task 20
- [x] Coming Due + Week Rotation + Captures + Calendar -- Task 21
- [x] Always-on Claude bar -- Task 17 (CaptureBar)
- [x] Realtime subscription -- Task 23
- [x] Accessibility floor -- Task 24

Against spec section 5 (API surface):
- [x] GET /api/spine/today -- Task 5
- [x] POST /api/spine/capture -- Task 6
- [x] GET /api/spine/inbox -- Task 7
- [x] POST /api/spine/parse/:id -- Task 7
- [x] Commitments GET/POST/PATCH -- Task 8
- [x] Signals GET/POST/PATCH -- Task 9
- [x] Focus GET/POST/PATCH -- Task 10
- [x] Cycle GET/PATCH -- Task 11

Against spec section 6 (parser):
- [x] Background mode (cron) -- Task 13
- [x] Inline mode (via POST /api/spine/parse/:id with bearer) -- Task 7 + Task 12
- [x] Claude API + Zod validation -- Task 12
- [x] Contacts index fuzzy match -- Task 12
- [x] Parser correction placeholder (Phase 4 scope, noted in spec) -- intentionally not in Phase 1

Against spec section 8 (phase 1 ship criteria):
- [x] Migrations, API, parser, crons, seed -- Tasks 1-16
- [x] Today Command UI -- Tasks 17-23
- [x] Accessibility -- Task 24
- [x] End-to-end verification -- Task 25

No gaps.

## Placeholder scan

Searched for: "TBD", "TODO", "fill in", "implement later", "similar to", "appropriate error handling".

Findings:
- Task 7 Step 3 notes `parseInboxEntry` is a stub replaced in Task 12. This is explicit and intentional sequencing, not a placeholder.
- Task 21 Content Calendar shows "Phase 5 populates this card" in empty state. This is a product-level statement to Alex, not a plan placeholder.
- Task 25 verification log has unchecked boxes for the human to fill in. This is intentional.

No actionable placeholders.

## Type consistency

- `parseInboxEntry()` signature matches across Task 7 stub and Task 12 real implementation (same `ParseResult` return type).
- `TodayPayloadT` is defined once in `types.ts` (Task 3) and imported by queries (Task 4), the `today` route (Task 5), the query hook (Task 17), and all card components (Tasks 17-21). No drift.
- `currentMondayISO` is defined once in `queries.ts` (Task 4) and reused in `focus/route.ts` (Task 10) and the rotation-build edge function (Task 15, duplicated because Deno edge can't import from src/).
- Zod schemas (`CommitmentCreate`, `CommitmentUpdate`, `SignalCreate`, etc.) defined in Task 3, consumed unchanged in Tasks 6-11.
- Quick-action button handlers in Tasks 18-20 all PATCH their respective `/api/spine/*/:id` routes with matching update schemas.

Consistency clean.

---

# Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-07-spine-phase1-ship.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** -- dispatch a fresh subagent per task, review between tasks, fast iteration. Uses `superpowers:subagent-driven-development`.

**2. Inline Execution** -- execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

Which approach?
