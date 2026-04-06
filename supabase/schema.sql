-- Relationship CRM Schema — Phase 1
-- Run this in your Supabase SQL Editor

-- ENUMS
create type relationship_strength as enum (
  'new', 'warm', 'active_partner', 'advocate', 'dormant'
);

create type interaction_type as enum (
  'call', 'text', 'email', 'meeting', 'broker_open', 'lunch', 'note'
);

create type task_priority as enum ('low', 'medium', 'high');
create type task_status as enum ('pending', 'in_progress', 'completed');
create type follow_up_status as enum ('pending', 'completed', 'skipped');

-- Lead status for future lead generation integration
create type lead_status as enum (
  'none', 'prospect', 'contacted', 'qualified', 'nurturing', 'converted', 'lost'
);

-- Contact source for tracking where leads/contacts originate
create type contact_source as enum (
  'manual', 'referral', 'broker_open', 'website', 'zillow', 'realtor_com',
  'social_media', 'cold_call', 'sign_call', 'open_house', 'import', 'other'
);

-- TAGS
create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text not null default '#64748b',
  created_at timestamptz default now(),
  unique(user_id, name)
);

-- CONTACTS
create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  first_name text not null,
  last_name text not null,
  company text,
  title text,
  email text,
  phone text,
  relationship relationship_strength default 'new',
  source contact_source default 'manual',
  lead_status lead_status default 'none',
  source_detail text,  -- free-text for specifics (e.g. "Zillow lead from 4821 E Calle Redonda")
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CONTACT <-> TAG join
create table contact_tags (
  contact_id uuid references contacts(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (contact_id, tag_id)
);

-- INTERACTIONS
create table interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete cascade not null,
  type interaction_type not null,
  summary text not null,
  occurred_at timestamptz default now(),
  created_at timestamptz default now()
);

-- NOTES
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TASKS
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  priority task_priority default 'medium',
  status task_status default 'pending',
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- FOLLOW-UPS
create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete cascade not null,
  reason text not null,
  due_date date not null,
  status follow_up_status default 'pending',
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- ROW LEVEL SECURITY
alter table contacts enable row level security;
alter table tags enable row level security;
alter table contact_tags enable row level security;
alter table interactions enable row level security;
alter table notes enable row level security;
alter table tasks enable row level security;
alter table follow_ups enable row level security;

create policy "Users manage own contacts" on contacts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users manage own tags" on tags
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users manage own contact_tags" on contact_tags
  for all using (
    contact_id in (select id from contacts where user_id = auth.uid())
  ) with check (
    contact_id in (select id from contacts where user_id = auth.uid())
  );

create policy "Users manage own interactions" on interactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users manage own notes" on notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users manage own tasks" on tasks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users manage own follow_ups" on follow_ups
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- INDEXES
create index idx_contacts_user on contacts(user_id);
create index idx_contacts_relationship on contacts(user_id, relationship);
create index idx_contacts_lead_status on contacts(user_id, lead_status) where lead_status != 'none';
create index idx_contacts_source on contacts(user_id, source);
create index idx_interactions_contact on interactions(contact_id);
create index idx_interactions_occurred on interactions(user_id, occurred_at desc);
create index idx_tasks_due on tasks(user_id, due_date) where status != 'completed';
create index idx_follow_ups_due on follow_ups(user_id, due_date) where status = 'pending';
create index idx_notes_contact on notes(contact_id);

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger contacts_updated_at before update on contacts
  for each row execute function update_updated_at();

create trigger notes_updated_at before update on notes
  for each row execute function update_updated_at();
