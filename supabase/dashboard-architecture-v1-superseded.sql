-- ============================================================
-- DASHBOARD ARCHITECTURE MIGRATION (Phase 1A)
-- ============================================================
-- Generated: 2026-04-06
-- Per: ~/.claude/rules/dashboard.md
-- Per: ~/Documents/Alex Hub(Obs)/digital-aesthetic-upgrade/docs:architecture:dashboard-widgets.md.md
--
-- WHAT THIS DOES (safe, additive, idempotent):
--   1. Defensively detects and adds contacts.user_id if missing
--   2. Adds user_id + RLS to opportunities (security fix)
--   3. Creates new deals table for actual escrow contracts (per Alex: opportunities = potential, deals = escrow)
--   4. Creates agent_relationship_health materialized view (Section 1 algorithm)
--   5. Creates refresh trigger on interactions and deals
--   6. Creates RLS-safe wrapper view agent_relationship_health_secure
--   7. Configures Supabase Realtime publication for dashboard tables
--
-- WHAT THIS DOES NOT DO (deferred to Phase 1B, see end of file):
--   - Drop contacts.temperature column (would break 13 files including action-scoring.ts)
--   - Rename or replace temperature in code
--
-- HOW TO RUN:
--   Open Supabase SQL Editor. Paste this entire file. Run.
--   Watch the NOTICE output -- it tells you whether user_id had to be added.
--   Re-runnable: every block uses IF NOT EXISTS / DROP IF EXISTS / DO blocks.
--
-- ROLLBACK PATH:
--   See bottom of file for the rollback SQL. Do not run unless you need to undo.
-- ============================================================


-- ============================================================
-- 0. PREREQ: contacts.user_id detection
-- ============================================================
-- The phase4-migration.sql file claimed contacts.user_id was removed.
-- The schema.sql file shows it as required. We do not know which is true
-- in the live DB. This block handles both cases safely.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contacts'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE contacts ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added contacts.user_id (was missing). BACKFILL REQUIRED before NOT NULL.';
    RAISE NOTICE 'Run: UPDATE contacts SET user_id = ''<your-auth-user-id>'' WHERE user_id IS NULL;';
  ELSE
    RAISE NOTICE 'contacts.user_id already exists. No change.';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id) WHERE user_id IS NOT NULL;


-- ============================================================
-- 1. opportunities security fix: user_id + RLS + soft delete
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE opportunities ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Backfill from contact's user_id where available
    UPDATE opportunities o
    SET user_id = c.user_id
    FROM contacts c
    WHERE o.contact_id = c.id AND o.user_id IS NULL AND c.user_id IS NOT NULL;

    RAISE NOTICE 'Added opportunities.user_id and backfilled from contacts.user_id where possible.';
    RAISE NOTICE 'Verify with: SELECT count(*) FROM opportunities WHERE user_id IS NULL;';
  END IF;
END $$;

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own opportunities" ON opportunities;
CREATE POLICY "Users manage own opportunities" ON opportunities
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_opportunities_user ON opportunities(user_id) WHERE deleted_at IS NULL;


-- ============================================================
-- 2. deals table -- actual escrow contracts
-- ============================================================
-- Distinct from opportunities (prospects/possibilities).
-- A deal is created when an opportunity converts to a signed contract.
-- The opportunity_id FK preserves the conversion history.

DO $$ BEGIN
  CREATE TYPE deal_stage AS ENUM (
    'under_contract',
    'in_escrow',
    'clear_to_close',
    'closed',
    'fell_through'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Conversion source (when an opportunity becomes a deal)
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,

  -- The agent who brought the deal
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,

  -- Property
  property_address text NOT NULL,
  property_city text,
  property_state text DEFAULT 'AZ',
  property_zip text,

  -- Parties
  buyer_name text,
  seller_name text,

  -- Money
  sale_price numeric(12, 2),
  earnest_money numeric(12, 2),
  commission_rate numeric(5, 4),

  -- Escrow specifics
  escrow_number text,
  escrow_company text,
  escrow_officer text,
  title_company text DEFAULT 'Great American Title Agency',

  -- Lender (links to a contact in the Tier 2 partner universe)
  lender_name text,
  lender_partner_id uuid REFERENCES contacts(id) ON DELETE SET NULL,

  -- Pipeline
  stage deal_stage DEFAULT 'under_contract',
  contract_date date,
  escrow_open_date date,
  scheduled_close_date date,
  actual_close_date date,

  -- Context
  notes text,

  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own deals" ON deals;
CREATE POLICY "Users manage own deals" ON deals
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_deals_user_active ON deals(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(user_id, stage)
  WHERE deleted_at IS NULL AND stage NOT IN ('closed', 'fell_through');
CREATE INDEX IF NOT EXISTS idx_deals_close_date ON deals(scheduled_close_date)
  WHERE deleted_at IS NULL AND stage IN ('in_escrow', 'clear_to_close');
CREATE INDEX IF NOT EXISTS idx_deals_lender ON deals(lender_partner_id)
  WHERE lender_partner_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_opportunity ON deals(opportunity_id)
  WHERE opportunity_id IS NOT NULL;

DROP TRIGGER IF EXISTS deals_updated_at ON deals;
CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 3. agent_relationship_health materialized view
-- ============================================================
-- Algorithm from Section 1 of the architecture doc:
--   recency 40% + deal trend 30% + frequency 20% + responsiveness 10% = 0..100

DROP MATERIALIZED VIEW IF EXISTS agent_relationship_health CASCADE;

CREATE MATERIALIZED VIEW agent_relationship_health AS
WITH interaction_stats AS (
  SELECT
    contact_id,
    COUNT(*) AS total_interactions,
    COUNT(*) FILTER (WHERE occurred_at >= now() - interval '30 days') AS interactions_30d,
    COUNT(*) FILTER (WHERE occurred_at >= now() - interval '90 days') AS interactions_90d,
    COUNT(*) FILTER (WHERE occurred_at >= now() - interval '90 days' AND direction = 'inbound') AS inbound_90d,
    MAX(occurred_at) AS last_contact_at
  FROM interactions
  GROUP BY contact_id
),
deal_stats AS (
  SELECT
    contact_id,
    COUNT(*) FILTER (WHERE stage = 'closed' AND actual_close_date >= now() - interval '90 days') AS deals_closed_90d,
    COUNT(*) FILTER (
      WHERE stage = 'closed'
        AND actual_close_date >= now() - interval '180 days'
        AND actual_close_date <  now() - interval '90 days'
    ) AS deals_closed_prev_90d,
    COUNT(*) FILTER (WHERE stage IN ('under_contract', 'in_escrow', 'clear_to_close')) AS active_deals
  FROM deals
  WHERE deleted_at IS NULL
  GROUP BY contact_id
),
component_scores AS (
  SELECT
    c.id AS contact_id,
    c.user_id,
    COALESCE(EXTRACT(day FROM now() - i.last_contact_at)::int, 999) AS days_since_contact,
    i.last_contact_at,
    COALESCE(i.total_interactions, 0) AS total_interactions,
    COALESCE(i.interactions_30d, 0) AS interactions_30d,
    COALESCE(i.interactions_90d, 0) AS interactions_90d,
    COALESCE(i.inbound_90d, 0) AS inbound_90d,
    COALESCE(d.deals_closed_90d, 0) AS deals_closed_90d,
    COALESCE(d.deals_closed_prev_90d, 0) AS deals_closed_prev_90d,
    COALESCE(d.active_deals, 0) AS active_deals,

    -- Recency (40% weight): 100 at <=7 days, linear decay to 0 at 60 days
    GREATEST(0, LEAST(100,
      100 - GREATEST(0, COALESCE(EXTRACT(day FROM now() - i.last_contact_at)::int, 999) - 7) * (100.0 / 53.0)
    ))::int AS recency_score,

    -- Deal trend (30% weight)
    CASE
      WHEN COALESCE(d.deals_closed_prev_90d, 0) = 0 AND COALESCE(d.deals_closed_90d, 0) > 0 THEN 100
      WHEN COALESCE(d.deals_closed_prev_90d, 0) = 0 THEN 50
      ELSE GREATEST(0, LEAST(100,
        50 + ((COALESCE(d.deals_closed_90d, 0) - d.deals_closed_prev_90d) * 100 / d.deals_closed_prev_90d)
      ))
    END::int AS deal_trend_score,

    -- Frequency (20% weight): 10+ interactions in 30 days = 100
    LEAST(100, COALESCE(i.interactions_30d, 0) * 10)::int AS frequency_score,

    -- Responsiveness (10% weight): pct of 90d interactions that were inbound
    CASE
      WHEN COALESCE(i.interactions_90d, 0) = 0 THEN 0
      ELSE (COALESCE(i.inbound_90d, 0) * 100 / i.interactions_90d)
    END::int AS responsiveness_score

  FROM contacts c
  LEFT JOIN interaction_stats i ON i.contact_id = c.id
  LEFT JOIN deal_stats d ON d.contact_id = c.id
  WHERE c.deleted_at IS NULL
)
SELECT
  contact_id,
  user_id,
  days_since_contact,
  last_contact_at,
  recency_score,
  deal_trend_score,
  frequency_score,
  responsiveness_score,

  -- Final weighted score
  GREATEST(0, LEAST(100, ROUND(
    (recency_score        * 0.40) +
    (deal_trend_score     * 0.30) +
    (frequency_score      * 0.20) +
    (responsiveness_score * 0.10)
  )))::int AS health_score,

  -- Trend direction (for the up/down/flat indicator in the agent grid)
  CASE
    WHEN deals_closed_90d > deals_closed_prev_90d THEN 'up'
    WHEN deals_closed_90d < deals_closed_prev_90d THEN 'down'
    ELSE 'flat'
  END AS trend_direction,

  -- Smart fields (Folk CRM pattern from Section 4)
  total_interactions,
  interactions_30d,
  deals_closed_90d,
  active_deals,

  now() AS computed_at
FROM component_scores;

-- Required for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_arh_contact ON agent_relationship_health(contact_id);
CREATE INDEX idx_arh_user_health ON agent_relationship_health(user_id, health_score DESC);
CREATE INDEX idx_arh_cold ON agent_relationship_health(user_id, days_since_contact DESC)
  WHERE days_since_contact > 14;


-- ============================================================
-- 4. RLS-safe wrapper view (materialized views do not support RLS directly)
-- ============================================================
-- Query this view from the client, not the materialized view.
-- security_invoker = true means it runs as the calling user, so RLS applies.

CREATE OR REPLACE VIEW agent_relationship_health_secure
  WITH (security_invoker = true) AS
SELECT *
FROM agent_relationship_health
WHERE user_id = auth.uid();


-- ============================================================
-- 5. Refresh function and triggers
-- ============================================================
-- Synchronous refresh inside the trigger. Fine for a 25-agent CRM.
-- If interaction volume grows beyond ~1000 events/day, switch to pg_cron debounced refresh.

CREATE OR REPLACE FUNCTION refresh_agent_relationship_health()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY agent_relationship_health;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS refresh_arh_on_interaction ON interactions;
CREATE TRIGGER refresh_arh_on_interaction
  AFTER INSERT OR UPDATE OR DELETE ON interactions
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_agent_relationship_health();

DROP TRIGGER IF EXISTS refresh_arh_on_deal ON deals;
CREATE TRIGGER refresh_arh_on_deal
  AFTER INSERT OR UPDATE OR DELETE ON deals
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_agent_relationship_health();

-- Initial population
REFRESH MATERIALIZED VIEW agent_relationship_health;


-- ============================================================
-- 6. Supabase Realtime publication
-- ============================================================
-- Tables that the dashboard widgets subscribe to for live updates.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'interactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE interactions;
    RAISE NOTICE 'Added interactions to supabase_realtime publication.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'opportunities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE opportunities;
    RAISE NOTICE 'Added opportunities to supabase_realtime publication.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'deals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE deals;
    RAISE NOTICE 'Added deals to supabase_realtime publication.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
    RAISE NOTICE 'Added tasks to supabase_realtime publication.';
  END IF;
END $$;


-- ============================================================
-- DONE. Verify with these queries:
-- ============================================================
--
-- SELECT count(*) FROM agent_relationship_health;
-- SELECT * FROM agent_relationship_health_secure ORDER BY health_score DESC LIMIT 10;
-- SELECT count(*) FROM opportunities WHERE user_id IS NULL;  -- should be 0
-- SELECT count(*) FROM deals;  -- should be 0 (new table)
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
--
-- ============================================================


-- ============================================================
-- PHASE 1B (DEFERRED -- DO NOT RUN YET)
-- ============================================================
--
-- Per Alex on 2026-04-06: "Replace temperature."
--
-- The contacts.temperature column is currently referenced in 13 files,
-- including the action-scoring algorithm itself:
--
--   src/lib/types.ts                                 (Contact type)
--   src/lib/action-scoring.ts                        (priority bonus calc)
--   src/components/dashboard/temperature-leaders.tsx
--   src/components/dashboard/temperature-summary.tsx
--   src/components/dashboard/action-queue.tsx
--   src/components/command-palette.tsx
--   src/app/(app)/dashboard/page.tsx
--   src/app/(app)/analytics/page.tsx
--   src/app/(app)/actions/page.tsx
--   src/app/(app)/contacts/[id]/page.tsx
--   src/app/api/webhooks/resend/route.ts
--   src/app/api/intake/route.ts
--   src/app/api/contacts/route.ts
--
-- Migration sequence (each step requires Alex approval):
--
-- Step 1. Update lib/types.ts: add health_score to Contact type (additive, both fields exist).
-- Step 2. Update lib/action-scoring.ts: read health_score instead of temperature.
-- Step 3. Update the 11 component/page files: read health_score from agent_relationship_health_secure.
-- Step 4. Decide what to do with temperature-leaders.tsx and temperature-summary.tsx (rename or repurpose).
-- Step 5. Verify no references remain: grep -r "\.temperature" src/
-- Step 6. THEN run: ALTER TABLE contacts DROP COLUMN temperature;
--
-- Until Step 6, contacts.temperature stays in place. The new health_score
-- from agent_relationship_health is additive and does not conflict.
-- ============================================================


-- ============================================================
-- ROLLBACK (for emergency only)
-- ============================================================
--
-- DROP TRIGGER IF EXISTS refresh_arh_on_interaction ON interactions;
-- DROP TRIGGER IF EXISTS refresh_arh_on_deal ON deals;
-- DROP FUNCTION IF EXISTS refresh_agent_relationship_health();
-- DROP VIEW IF EXISTS agent_relationship_health_secure;
-- DROP MATERIALIZED VIEW IF EXISTS agent_relationship_health;
-- DROP TABLE IF EXISTS deals;
-- DROP TYPE IF EXISTS deal_stage;
-- ALTER TABLE opportunities DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Users manage own opportunities" ON opportunities;
-- ALTER PUBLICATION supabase_realtime DROP TABLE interactions, opportunities, deals, tasks;
--
-- Note: rollback does NOT remove user_id columns added by this migration.
-- That has to be done manually if needed.
-- ============================================================
