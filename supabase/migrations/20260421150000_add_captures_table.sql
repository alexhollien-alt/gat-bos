-- Universal Capture Bar v1: captures table
-- Idempotent per ~/crm/CLAUDE.md. Uses existing public.set_updated_at() trigger fn
-- (see baseline.sql line 1572 for the contacts table using the same pattern).

create table if not exists public.captures (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  raw_text          text not null,
  parsed_intent     text,
  parsed_contact_id uuid references public.contacts(id) on delete set null,
  parsed_payload    jsonb not null default '{}'::jsonb,
  processed         boolean not null default false,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade
);

-- Enum-style check (kept simple; add new intents by dropping+recreating this constraint)
alter table public.captures drop constraint if exists captures_parsed_intent_check;
alter table public.captures add constraint captures_parsed_intent_check
  check (parsed_intent is null or parsed_intent in (
    'interaction','follow_up','ticket','note','unprocessed'
  ));

create index if not exists captures_user_created_idx
  on public.captures (user_id, created_at desc);

create index if not exists captures_unprocessed_idx
  on public.captures (user_id, processed) where processed = false;

create index if not exists captures_contact_idx
  on public.captures (parsed_contact_id) where parsed_contact_id is not null;

alter table public.captures enable row level security;

drop policy if exists "Users manage own captures" on public.captures;
create policy "Users manage own captures" on public.captures
  for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- updated_at trigger (reuse the shared function used by contacts/tasks/campaigns)
drop trigger if exists set_captures_updated_at on public.captures;
create trigger set_captures_updated_at
  before update on public.captures
  for each row execute function public.set_updated_at();
