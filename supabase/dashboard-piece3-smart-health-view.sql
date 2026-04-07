-- ============================================================
-- DASHBOARD ARCHITECTURE -- PIECE 3 OF 3 (REVISION 2)
-- Smart coalesce view: manual override wins, computed score fills the gap
-- ============================================================
-- Generated: 2026-04-06
-- Revision 2: trimmed to columns guaranteed to exist on contacts.
-- The original v1 referenced c.company which does not exist in the live DB.
-- Schema has drifted from schema.sql at some point. This version only
-- references columns we know are present (id, user_id, health_score,
-- deleted_at). Widgets that need first_name/email/etc can join this view
-- to contacts themselves.
--
-- Per: ~/.claude/rules/dashboard.md
--
-- PREREQ: Pieces 1 and 2 must have run successfully.
--
-- HOW TO RUN:
--   Open Supabase SQL Editor. Paste this file. Run.
--
-- HOW TO USE FROM CODE:
--   Option A (simple, one query):
--     supabase
--       .from('agent_health')
--       .select('*, contacts(first_name, last_name, email, phone, tier, headshot_url)')
--       .order('health_score', { ascending: false })
--       .limit(8);
--
--   Option B (two queries):
--     const health = await supabase.from('agent_health').select('*');
--     const contacts = await supabase.from('contacts').select('id, first_name, last_name, ...');
--     // merge in JS by contact_id
-- ============================================================


CREATE OR REPLACE VIEW agent_health
  WITH (security_invoker = true) AS
SELECT
  c.id AS contact_id,
  c.user_id,

  -- Smart health score: manual value wins when set, computed fills the gap
  COALESCE(
    NULLIF(c.health_score, 0),
    arh.computed_health_score,
    0
  ) AS health_score,

  -- Surface the source so the UI can show "manual" vs "auto" if it wants
  CASE
    WHEN c.health_score IS NOT NULL AND c.health_score > 0 THEN 'manual'
    WHEN arh.computed_health_score IS NOT NULL THEN 'computed'
    ELSE 'none'
  END AS health_score_source,

  -- Computed components from the materialized view
  arh.computed_health_score,
  arh.recency_score,
  arh.deal_trend_score,
  arh.frequency_score,
  arh.responsiveness_score,
  arh.trend_direction,
  arh.days_since_contact,
  arh.last_contact_at,
  arh.total_interactions,
  arh.interactions_30d,
  arh.deals_closed_90d,
  arh.active_deals,
  arh.computed_at AS health_computed_at

FROM contacts c
LEFT JOIN agent_relationship_health arh ON arh.contact_id = c.id
WHERE c.deleted_at IS NULL;


-- ============================================================
-- VERIFY
-- ============================================================
--
-- 1. View returns rows:
--    SELECT count(*) FROM agent_health;
--
-- 2. Manual scores still win:
--    SELECT contact_id, health_score, computed_health_score, health_score_source
--    FROM agent_health
--    WHERE health_score_source = 'manual'
--    LIMIT 5;
--
-- 3. Top 10 for the dashboard widget (with contact details joined):
--    SELECT
--      ah.contact_id,
--      ah.health_score,
--      ah.days_since_contact,
--      ah.trend_direction,
--      c.first_name,
--      c.last_name
--    FROM agent_health ah
--    JOIN contacts c ON c.id = ah.contact_id
--    ORDER BY ah.health_score DESC NULLS LAST
--    LIMIT 10;
--
-- ============================================================


-- ============================================================
-- Optional: introspect the live contacts table
-- ============================================================
-- Run this to see what columns ACTUALLY exist on contacts in your live DB.
-- Useful to catch any other schema drift.
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'contacts'
-- ORDER BY ordinal_position;
--
-- ============================================================


-- ============================================================
-- ROLLBACK
-- ============================================================
--
-- DROP VIEW IF EXISTS agent_health;
--
-- ============================================================
