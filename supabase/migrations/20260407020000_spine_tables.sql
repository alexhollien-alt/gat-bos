-- DEPRECATED (Slice 1, 2026-04-22): spine tables superseded by activity_events. Will be dropped in Slice 2.
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
