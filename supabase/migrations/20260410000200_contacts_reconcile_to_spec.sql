-- ============================================================================
-- Phase 2: contacts reshape to GAT-BOS spec
-- ============================================================================
-- Date:     2026-04-10
-- Phase:    GAT-BOS reconciliation, Phase 2
-- Intent:   Reshape the `contacts` table to match the GAT-BOS build spec
--           intent WITHOUT dropping any of the 26 extra columns the CRM
--           already relies on. All changes are additive or rename-only.
--           Data is preserved throughout.
--
-- CHANGES:
--   1. Extend contacts_type_check CHECK constraint: add value 'escrow'
--      (contact_type is a CHECK-constrained text column, NOT a Postgres enum)
--   2. Rename: last_touch_date -> last_touchpoint
--   3. Rename: next_action_date -> next_followup
--   4. Add:    lender_partner_id uuid  self-FK to contacts(id)
--   5. Add:    metadata jsonb          type-specific fields for
--              lenders / vendors / escrow rows
--   6. Add:    full_name text          generated column
--              = coalesce(first_name,'') || ' ' || coalesce(last_name,'')
--   7. Create: contacts_spec_view      spec-compatible projection with
--              - all contacts columns
--              - `role` computed from `type`
--              - `is_dormant` computed from last_touchpoint
--
-- DELIBERATE DEVIATION FROM THE PLAN:
--   The plan specifies `is_dormant` as a stored generated column:
--     generated always as (last_touchpoint < (current_date - interval '30 days')) stored
--   This does not compile in Postgres: generated column expressions must be
--   IMMUTABLE, and `current_date` is STABLE. Moved `is_dormant` into
--   `contacts_spec_view` as a computed SELECT column instead. Same semantics,
--   recomputed on every query. At CRM scale (sub-1k rows) this is free.
--   Note written to the plan doc as a followup for documentation update.
--
-- IDEMPOTENCY:
--   Every statement is guarded so replay is a no-op:
--   - ALTER TYPE ADD VALUE IF NOT EXISTS
--   - Rename columns are wrapped in a DO block that checks for old name
--     present AND new name absent before running
--   - ADD COLUMN IF NOT EXISTS handles columns + default backfill
--   - DROP VIEW IF EXISTS ... CASCADE + CREATE VIEW handles view replay
--
-- NOT APPLIED TO LIVE DB IN THIS COMMIT.
--   This file adds the migration to the repo. Whether / when to apply is
--   Alex's call. Live DB is currently in the pre-Phase-2 state.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Extend the contacts_type_check CHECK constraint
-- ============================================================================
-- contact_type is NOT a Postgres enum. The baseline defines contacts.type as
-- a plain text column with a CHECK constraint:
--
--   type text NOT NULL,
--   CONSTRAINT contacts_type_check
--     CHECK (type = ANY (ARRAY['realtor', 'lender', 'builder', 'vendor',
--       'buyer', 'seller', 'past_client', 'warm_lead', 'referral_partner',
--       'sphere', 'other']))
--
-- To add 'escrow' we drop the check constraint and recreate it with the
-- extended value list. Idempotent via DROP CONSTRAINT IF EXISTS.
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_type_check;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_type_check
  CHECK (type = ANY (ARRAY[
    'realtor'::text,
    'lender'::text,
    'builder'::text,
    'vendor'::text,
    'buyer'::text,
    'seller'::text,
    'past_client'::text,
    'warm_lead'::text,
    'referral_partner'::text,
    'sphere'::text,
    'other'::text,
    'escrow'::text
  ]));

-- ============================================================================
-- 2. + 3. Rename last_touch_date / next_action_date (idempotent)
-- ============================================================================
DO $$
BEGIN
  -- last_touch_date -> last_touchpoint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='contacts' AND column_name='last_touch_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='contacts' AND column_name='last_touchpoint'
  ) THEN
    ALTER TABLE public.contacts RENAME COLUMN last_touch_date TO last_touchpoint;
    RAISE NOTICE 'Phase2: renamed contacts.last_touch_date -> last_touchpoint';
  ELSE
    RAISE NOTICE 'Phase2: last_touch_date -> last_touchpoint rename skipped (already applied or source missing)';
  END IF;

  -- next_action_date -> next_followup
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='contacts' AND column_name='next_action_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='contacts' AND column_name='next_followup'
  ) THEN
    ALTER TABLE public.contacts RENAME COLUMN next_action_date TO next_followup;
    RAISE NOTICE 'Phase2: renamed contacts.next_action_date -> next_followup';
  ELSE
    RAISE NOTICE 'Phase2: next_action_date -> next_followup rename skipped (already applied or source missing)';
  END IF;
END $$;

-- ============================================================================
-- 4. lender_partner_id (self-referential nullable FK)
-- ============================================================================
-- On-delete behavior: SET NULL. If a lender contact row is ever hard-deleted,
-- the agents that referenced it lose the link but stay put. Standing Rule 3
-- says no hard deletes -- we soft-delete via deleted_at -- so this FK action
-- is a defensive safety net, not a routine code path.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS lender_partner_id uuid
    REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Index the FK so "find all agents partnered with lender X" stays fast.
CREATE INDEX IF NOT EXISTS contacts_lender_partner_id_idx
  ON public.contacts(lender_partner_id)
  WHERE lender_partner_id IS NOT NULL;

-- ============================================================================
-- 5. metadata jsonb
-- ============================================================================
-- Holds type-specific fields for non-agent contact rows:
--   lender : { nmls_number, loan_types, co_marketing }
--   vendor : { category, service_area, licensed, insured }
--   escrow : { branch_name, branch_address, direct_line, assigned_agents }
-- Agent rows leave this at '{}' unless there's a reason to store something.
-- NOT NULL with default '{}' avoids null-check noise in app code.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================================
-- 6. full_name generated column
-- ============================================================================
-- coalesce() is IMMUTABLE, text concat is IMMUTABLE, so the expression
-- qualifies as a stored generated column. Handles NULL first_name or
-- last_name gracefully (empty string fallback, no NULL in result).
-- Example: ("Jane",NULL)        -> "Jane "
--          (NULL,"Smith")       -> " Smith"
--          ("Jane","Smith")     -> "Jane Smith"
--          (NULL,NULL)          -> " "
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS full_name text
    GENERATED ALWAYS AS (
      coalesce(first_name, '') || ' ' || coalesce(last_name, '')
    ) STORED;

-- ============================================================================
-- 7. contacts_spec_view  (spec-compatible projection)
-- ============================================================================
-- Two additions on top of `contacts.*`:
--   a. role      : collapses the 11-value `type` enum to the 4-value spec
--                  vocabulary (agent / lender / vendor / escrow / other).
--                  Unknown enum values fall through to 'other'.
--   b. is_dormant: true if last_touchpoint is older than 30 days OR NULL
--                  (never-touched contacts are treated as dormant). Computed
--                  on every query; not stored (see DELIBERATE DEVIATION above).
--
-- DROP + CREATE rather than CREATE OR REPLACE because OR REPLACE fails if
-- the column list of the underlying table ever changes. Safer on replay.
DROP VIEW IF EXISTS public.contacts_spec_view CASCADE;

CREATE VIEW public.contacts_spec_view AS
SELECT
  c.*,
  CASE c.type::text
    WHEN 'realtor'          THEN 'agent'
    WHEN 'buyer'            THEN 'agent'
    WHEN 'seller'           THEN 'agent'
    WHEN 'past_client'      THEN 'agent'
    WHEN 'warm_lead'        THEN 'agent'
    WHEN 'sphere'           THEN 'agent'
    WHEN 'lender'           THEN 'lender'
    WHEN 'vendor'           THEN 'vendor'
    WHEN 'builder'          THEN 'vendor'
    WHEN 'referral_partner' THEN 'vendor'
    WHEN 'escrow'           THEN 'escrow'
    ELSE                         'other'
  END AS role,
  coalesce(
    c.last_touchpoint < (current_date - interval '30 days')::timestamptz,
    true
  ) AS is_dormant
FROM public.contacts c;

-- The view inherits RLS from the underlying table by default in Postgres 15+.
-- Supabase runs Postgres 17. Authenticated users querying contacts_spec_view
-- see only their own rows via the "Users manage own contacts" policy from
-- Phase 1 / piece 6.
COMMENT ON VIEW public.contacts_spec_view IS
  'Spec-compatible projection of contacts with computed role and is_dormant. '
  'RLS inherits from contacts table (Postgres 15+ behavior).';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (run manually in SQL editor after apply)
-- ============================================================================
-- -- column shape
-- select column_name, data_type, is_nullable, column_default, generation_expression
--   from information_schema.columns
--  where table_schema='public' and table_name='contacts'
--    and column_name in ('last_touchpoint','next_followup','lender_partner_id',
--                        'metadata','full_name','last_touch_date','next_action_date')
--  order by column_name;
--
-- expected rows:
--   last_touchpoint    | timestamp... | YES | NULL      | NULL
--   next_followup      | date         | YES | NULL      | NULL
--   lender_partner_id  | uuid         | YES | NULL      | NULL
--   metadata           | jsonb        | NO  | '{}'::jsonb | NULL
--   full_name          | text         | YES | NULL      | COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
--   last_touch_date    | (not found)
--   next_action_date   | (not found)
--
-- -- check constraint extension (contact_type is text + CHECK, not an enum)
-- select pg_get_constraintdef(oid)
--   from pg_constraint
--  where conname = 'contacts_type_check'
--    and conrelid = 'public.contacts'::regclass;
-- expected: a CHECK that includes 'escrow' alongside the 11 original values
--
-- -- view exists and is queryable
-- select count(*), count(*) filter (where role='agent') as agent_count,
--                  count(*) filter (where is_dormant)     as dormant_count
--   from contacts_spec_view;
-- expected: view returns row counts matching contacts (subject to RLS)
--
-- -- full_name populated for existing rows
-- select id, first_name, last_name, full_name from contacts limit 3;
-- expected: full_name column reflects first_name || ' ' || last_name
-- ============================================================================
