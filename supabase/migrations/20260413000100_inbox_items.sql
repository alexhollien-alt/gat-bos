-- inbox_items: Gmail threads Claude has scored as needing a reply.
-- One row per (user, thread). Idempotent on the unique constraint.

create table if not exists public.inbox_items (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null default auth.uid()
                                  references auth.users(id),
  gmail_thread_id   text        not null,
  sender_email      text        not null,
  sender_name       text        not null default '',
  subject           text        not null default '(no subject)',
  snippet           text        not null default '',
  received_at       timestamptz not null,
  score             integer     not null default 0
                                  check (score >= 0 and score <= 100),
  matched_rules     jsonb       not null default '[]'::jsonb,
  contact_id        uuid        references public.contacts(id) on delete set null,
  contact_name      text,
  contact_tier      text,
  status            text        not null default 'pending'
                                  check (status in ('pending','replied','dismissed')),
  dismissed_at      timestamptz,
  created_at        timestamptz not null default now(),

  constraint inbox_items_user_thread_unique unique (user_id, gmail_thread_id)
);

create index if not exists inbox_items_user_status_received_idx
  on public.inbox_items (user_id, status, received_at desc)
  where dismissed_at is null;

alter table public.inbox_items enable row level security;

drop policy if exists inbox_items_owner on public.inbox_items;
create policy inbox_items_owner on public.inbox_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
