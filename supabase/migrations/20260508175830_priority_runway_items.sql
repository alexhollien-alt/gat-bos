-- Priority Runway items (today-v2)
-- User-owned ordered list of items to clear in sequence. Replaces the
-- email_drafts + project_touchpoints heuristic that backed the prototype.
--
-- Idempotent at the policy/trigger/index layer. Table itself uses
-- CREATE TABLE IF NOT EXISTS so re-runs preserve user data.

create table if not exists public.priority_runway_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  position      smallint not null,
  title         text not null,
  context       jsonb not null default '{}'::jsonb,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists priority_runway_items_user_open_idx
  on public.priority_runway_items (user_id, deleted_at, position);

create index if not exists priority_runway_items_user_completed_idx
  on public.priority_runway_items (user_id, completed_at);

-- updated_at auto-bump
create or replace function public.priority_runway_items_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_priority_runway_items_updated_at
  on public.priority_runway_items;
create trigger trg_priority_runway_items_updated_at
  before update on public.priority_runway_items
  for each row execute function public.priority_runway_items_set_updated_at();

-- RLS
alter table public.priority_runway_items enable row level security;

drop policy if exists "runway: owner select" on public.priority_runway_items;
create policy "runway: owner select"
  on public.priority_runway_items for select
  using (user_id = auth.uid());

drop policy if exists "runway: owner insert" on public.priority_runway_items;
create policy "runway: owner insert"
  on public.priority_runway_items for insert
  with check (user_id = auth.uid());

drop policy if exists "runway: owner update" on public.priority_runway_items;
create policy "runway: owner update"
  on public.priority_runway_items for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "runway: owner delete" on public.priority_runway_items;
create policy "runway: owner delete"
  on public.priority_runway_items for delete
  using (user_id = auth.uid());

comment on table public.priority_runway_items is
  'today-v2 Priority Runway. User-owned ordered items, soft-deleted via deleted_at, click-to-complete via completed_at.';
