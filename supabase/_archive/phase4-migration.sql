-- Phase 4 Migration: Marketing Fields + Opportunities
-- HISTORY: This file originally documented contacts as having no user_id.
--   That assumption was reversed in dashboard-piece2-add-infrastructure.sql
--   (re-added contacts.user_id as nullable) and finalized in
--   dashboard-piece5-contacts-user-id-lockdown.sql (backfill + DEFAULT auth.uid()
--   + NOT NULL). Read those two pieces for the current state of contacts.user_id.
-- Run in Supabase SQL Editor -- Idempotent

-- ============================================================
-- 1. ENUMS (conditional creation)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE opportunity_stage AS ENUM (
    'prospect', 'under_contract', 'in_escrow', 'closed', 'fell_through'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. ALTER contacts -- add marketing + relationship fields
-- Fields already in live DB (skip): website_url, brokerage,
--   stage, tags, last_touch_date, next_action, deleted_at
-- ============================================================

-- Visual assets (URLs or paths)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS headshot_url text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS brokerage_logo_url text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS agent_logo_url text;

-- Brand tokens for design production
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS brand_colors jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS palette text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS font_kit text;

-- Business geography
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS farm_area text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS farm_zips text[];

-- Relationship scoring
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS temperature integer DEFAULT 0 CHECK (temperature >= 0 AND temperature <= 100);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS rep_pulse integer CHECK (rep_pulse >= 1 AND rep_pulse <= 10);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tier text CHECK (tier IN ('A', 'B', 'C', 'P'));

-- Relationship context
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_channel text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS referred_by text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS escrow_officer text;

-- Reference to CONTACT.md for skill integration
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_md_path text;

-- ============================================================
-- 3. ALTER interactions -- add direction + duration
-- ============================================================

ALTER TABLE interactions ADD COLUMN IF NOT EXISTS direction text CHECK (direction IN ('inbound', 'outbound'));
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS duration_minutes integer;

-- ============================================================
-- 4. CREATE opportunities table
-- ============================================================

CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,

  -- Property
  property_address text NOT NULL,
  property_city text,
  property_state text DEFAULT 'AZ',
  property_zip text,
  sale_price numeric(12, 2),

  -- Pipeline
  stage opportunity_stage DEFAULT 'prospect',
  escrow_number text,
  opened_at date,
  expected_close_date date,
  closed_at date,

  -- Context
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 5. INDEXES on new marketing fields
-- ============================================================
-- Historical note: this section originally said "no user_id on contacts"
-- which was true when this file was authored. contacts.user_id was
-- later re-added (Piece 2), backfilled and locked NOT NULL (Piece 5
-- retry, 2026-04-07). The user_id index lives in the Piece 2 file.

CREATE INDEX IF NOT EXISTS idx_contacts_tier ON contacts(tier) WHERE tier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_temperature ON contacts(temperature DESC);

CREATE INDEX IF NOT EXISTS idx_opportunities_contact ON opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage) WHERE stage NOT IN ('closed', 'fell_through');
CREATE INDEX IF NOT EXISTS idx_opportunities_close ON opportunities(expected_close_date) WHERE stage = 'in_escrow';

-- ============================================================
-- 6. Updated_at trigger on opportunities
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS opportunities_updated_at ON opportunities;
CREATE TRIGGER opportunities_updated_at BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
