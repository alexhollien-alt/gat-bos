-- Campaign Engine Schema — Phase 2
-- Run this in your Supabase SQL Editor after schema.sql

-- ENUMS
create type campaign_type as enum ('drip', 'marketing');
create type campaign_status as enum ('draft', 'active', 'paused', 'archived');
create type step_type as enum ('email', 'call', 'text', 'mail', 'social', 'task');
create type enrollment_status as enum ('active', 'completed', 'paused', 'removed');

-- CAMPAIGNS
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  type campaign_type not null default 'drip',
  status campaign_status not null default 'draft',
  step_count integer not null default 0,
  enrolled_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- CAMPAIGN STEPS
create table campaign_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade not null,
  step_number integer not null,
  step_type step_type not null default 'email',
  title text not null,
  content text,
  delay_days integer not null default 0,
  email_subject text,
  email_body_html text,
  awareness_level text, -- unaware, problem_aware, solution_aware, product_aware, most_aware
  step_goal text,       -- hook, problem, agitate, credibility, solution, proof, objections, offer, urgency, cta
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- CAMPAIGN ENROLLMENTS
create table campaign_enrollments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete cascade not null,
  status enrollment_status not null default 'active',
  current_step integer not null default 1,
  enrolled_at timestamptz default now(),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  unique(campaign_id, contact_id)
);

-- CAMPAIGN STEP COMPLETIONS
create table campaign_step_completions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid references campaign_enrollments(id) on delete cascade not null,
  step_id uuid references campaign_steps(id) on delete cascade not null,
  completed_at timestamptz default now(),
  completed_by uuid references auth.users(id),
  email_sent_at timestamptz,
  email_delivered boolean default false,
  email_opened boolean default false,
  resend_message_id text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  unique(enrollment_id, step_id)
);

-- ROW LEVEL SECURITY
alter table campaigns enable row level security;
alter table campaign_steps enable row level security;
alter table campaign_enrollments enable row level security;
alter table campaign_step_completions enable row level security;

create policy "Users manage own campaigns" on campaigns
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users manage own campaign steps" on campaign_steps
  for all using (
    campaign_id in (select id from campaigns where user_id = auth.uid())
  ) with check (
    campaign_id in (select id from campaigns where user_id = auth.uid())
  );

create policy "Users manage own campaign enrollments" on campaign_enrollments
  for all using (
    campaign_id in (select id from campaigns where user_id = auth.uid())
  ) with check (
    campaign_id in (select id from campaigns where user_id = auth.uid())
  );

create policy "Users manage own step completions" on campaign_step_completions
  for all using (
    enrollment_id in (
      select ce.id from campaign_enrollments ce
      join campaigns c on c.id = ce.campaign_id
      where c.user_id = auth.uid()
    )
  ) with check (
    enrollment_id in (
      select ce.id from campaign_enrollments ce
      join campaigns c on c.id = ce.campaign_id
      where c.user_id = auth.uid()
    )
  );

-- INDEXES
create index idx_campaigns_user on campaigns(user_id);
create index idx_campaigns_status on campaigns(user_id, status) where deleted_at is null;
create index idx_campaign_steps_campaign on campaign_steps(campaign_id, step_number) where deleted_at is null;
create index idx_campaign_enrollments_campaign on campaign_enrollments(campaign_id) where deleted_at is null;
create index idx_campaign_enrollments_contact on campaign_enrollments(contact_id) where deleted_at is null;
create index idx_step_completions_enrollment on campaign_step_completions(enrollment_id) where deleted_at is null;

-- UPDATED_AT TRIGGERS (reuses update_updated_at from schema.sql)
create trigger campaigns_updated_at before update on campaigns
  for each row execute function update_updated_at();

create trigger campaign_steps_updated_at before update on campaign_steps
  for each row execute function update_updated_at();

create trigger campaign_enrollments_updated_at before update on campaign_enrollments
  for each row execute function update_updated_at();

create trigger campaign_step_completions_updated_at before update on campaign_step_completions
  for each row execute function update_updated_at();
