-- Listing Activity checklist (today-v2)
-- One-row-per-project checklist for the four marketing items shown on each
-- listing card. Replaces the project_touchpoints heuristic (ref: queries.ts
-- :374-378 BLOCKERS flag).
--
-- RLS pass-through: a user can read/write a checklist row iff they can read
-- the parent project. projects already has user_id = auth.uid() isolation.

create table if not exists public.listing_activity_checklist (
  listing_id      uuid primary key references public.projects(id) on delete cascade,
  flyer_done      boolean not null default false,
  social_done     boolean not null default false,
  email_done      boolean not null default false,
  note_done       boolean not null default false,
  flyer_done_at   timestamptz,
  social_done_at  timestamptz,
  email_done_at   timestamptz,
  note_done_at    timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists listing_activity_checklist_completed_idx
  on public.listing_activity_checklist (completed_at);

-- Stamp per-checkbox *_done_at on flip-to-true, clear on flip-to-false.
-- Stamp completed_at when all four are true, clear when any flips false.
-- Also bump updated_at on every update.
create or replace function public.listing_activity_checklist_stamp()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.flyer_done is distinct from old.flyer_done then
      new.flyer_done_at := case when new.flyer_done then now() else null end;
    end if;
    if new.social_done is distinct from old.social_done then
      new.social_done_at := case when new.social_done then now() else null end;
    end if;
    if new.email_done is distinct from old.email_done then
      new.email_done_at := case when new.email_done then now() else null end;
    end if;
    if new.note_done is distinct from old.note_done then
      new.note_done_at := case when new.note_done then now() else null end;
    end if;
    new.updated_at := now();
  elsif tg_op = 'INSERT' then
    if new.flyer_done  then new.flyer_done_at  := coalesce(new.flyer_done_at,  now()); end if;
    if new.social_done then new.social_done_at := coalesce(new.social_done_at, now()); end if;
    if new.email_done  then new.email_done_at  := coalesce(new.email_done_at,  now()); end if;
    if new.note_done   then new.note_done_at   := coalesce(new.note_done_at,   now()); end if;
  end if;

  if new.flyer_done and new.social_done and new.email_done and new.note_done then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;

  return new;
end $$;

drop trigger if exists trg_listing_activity_checklist_stamp
  on public.listing_activity_checklist;
create trigger trg_listing_activity_checklist_stamp
  before insert or update on public.listing_activity_checklist
  for each row execute function public.listing_activity_checklist_stamp();

-- RLS
alter table public.listing_activity_checklist enable row level security;

drop policy if exists "checklist: project owner select"
  on public.listing_activity_checklist;
create policy "checklist: project owner select"
  on public.listing_activity_checklist for select
  using (exists (
    select 1 from public.projects p
    where p.id = listing_id and p.user_id = auth.uid()
  ));

drop policy if exists "checklist: project owner insert"
  on public.listing_activity_checklist;
create policy "checklist: project owner insert"
  on public.listing_activity_checklist for insert
  with check (exists (
    select 1 from public.projects p
    where p.id = listing_id and p.user_id = auth.uid()
  ));

drop policy if exists "checklist: project owner update"
  on public.listing_activity_checklist;
create policy "checklist: project owner update"
  on public.listing_activity_checklist for update
  using (exists (
    select 1 from public.projects p
    where p.id = listing_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = listing_id and p.user_id = auth.uid()
  ));

drop policy if exists "checklist: project owner delete"
  on public.listing_activity_checklist;
create policy "checklist: project owner delete"
  on public.listing_activity_checklist for delete
  using (exists (
    select 1 from public.projects p
    where p.id = listing_id and p.user_id = auth.uid()
  ));

comment on table public.listing_activity_checklist is
  'today-v2 Listing Activity. One row per listing project. Booleans drive UI checkboxes; trigger stamps per-flag _at and overall completed_at.';
