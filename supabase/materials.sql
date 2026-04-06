-- Materials & Print Requests Schema -- Phase 3
-- Run this in your Supabase SQL Editor after campaigns.sql
-- Mirrors Alex's Cypher ticket workflow from his perspective:
-- what was ordered, for which agent, design links, and status.
-- Internal production details (printer assignments, courier routing,
-- per-sheet costs, branch shipping) stay in Cypher.

-- ENUMS
create type material_request_type as enum ('print_ready', 'design_help', 'template_request');
create type material_request_status as enum ('draft', 'submitted', 'in_production', 'complete');
create type material_request_priority as enum ('standard', 'rush');
create type product_type as enum ('flyer', 'brochure', 'door_hanger', 'eddm', 'postcard', 'other');
create type design_asset_type as enum ('flyer', 'brochure', 'door_hanger', 'eddm', 'postcard', 'social', 'presentation', 'other');

-- MATERIAL REQUESTS (the order header -- one per Cypher ticket equivalent)
drop table if exists material_request_items;
drop table if exists material_requests;
drop table if exists design_assets;

create table material_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete cascade not null,
  title text not null,
  request_type material_request_type not null default 'print_ready',
  status material_request_status not null default 'draft',
  priority material_request_priority not null default 'standard',
  notes text,                    -- instructions to production team
  submitted_at timestamptz,      -- when Alex sent to Cypher
  completed_at timestamptz,      -- when production confirmed done
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- MATERIAL REQUEST ITEMS (line items -- one per product in the order)
create table material_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references material_requests(id) on delete cascade not null,
  product_type product_type not null default 'flyer',
  quantity integer not null default 1,
  design_url text,               -- Canva link for this specific item
  description text,              -- special instructions per line item
  created_at timestamptz default now()
);

-- DESIGN ASSETS (reusable Canva link library, indexed per agent)
create table design_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete cascade not null,
  name text not null,
  url text not null,
  asset_type design_asset_type not null default 'flyer',
  listing_address text,          -- optional, for property-specific pieces
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- ROW LEVEL SECURITY
alter table material_requests enable row level security;
alter table material_request_items enable row level security;
alter table design_assets enable row level security;

create policy "Users manage own material requests" on material_requests
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users manage own material request items" on material_request_items
  for all using (
    request_id in (select id from material_requests where user_id = auth.uid())
  ) with check (
    request_id in (select id from material_requests where user_id = auth.uid())
  );

create policy "Users manage own design assets" on design_assets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- INDEXES
create index idx_material_requests_user on material_requests(user_id);
create index idx_material_requests_contact on material_requests(contact_id) where deleted_at is null;
create index idx_material_requests_status on material_requests(user_id, status) where deleted_at is null;
create index idx_material_request_items_request on material_request_items(request_id);
create index idx_design_assets_user on design_assets(user_id) where deleted_at is null;
create index idx_design_assets_contact on design_assets(contact_id) where deleted_at is null;

-- UPDATED_AT TRIGGERS (reuses update_updated_at from schema.sql)
create trigger material_requests_updated_at before update on material_requests
  for each row execute function update_updated_at();

create trigger design_assets_updated_at before update on design_assets
  for each row execute function update_updated_at();
