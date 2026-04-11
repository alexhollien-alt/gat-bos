-- ============================================================
-- DASHBOARD ARCHITECTURE -- PIECE 5 (SECURITY PATCH)
-- Lock down agent_relationship_health materialized view
-- ============================================================
-- Generated: 2026-04-12
--
-- Problem
-- -------
-- public.agent_relationship_health is a materialized view, and PostgreSQL
-- does not support row-level security on materialized views. It was created
-- in public schema with default PUBLIC grants, so the authenticated role
-- (and therefore every logged-in Supabase user, across every tenant) can
-- query it directly through PostgREST:
--
--   GET /rest/v1/agent_relationship_health
--
-- Today this is a single-user system so the blast radius is zero. The moment
-- Phase 5.x introduces multi-user, any authenticated user can read health
-- scores, deal counts, and interaction velocity for every other user's
-- contacts. This is the canary bug for the multi-tenant data leak.
--
-- The public.agent_health wrapper view (from piece 3) currently uses
-- `security_invoker = true`, so it relies on the invoker having SELECT on
-- the materialized view. A naive REVOKE would break the dashboard because
-- the wrapper would no longer be able to read the MV on behalf of the user.
--
-- Fix
-- ---
-- 1. REVOKE all grants on the materialized view from anon, authenticated,
--    and PUBLIC. Keep service_role (the refresh function runs SECURITY
--    DEFINER so it does not depend on this, but we grant it explicitly to
--    be unambiguous and to allow admin tooling).
-- 2. Rebuild public.agent_health with `security_invoker = false` so it runs
--    as its owner (postgres), which retains SELECT on the MV.
-- 3. Add an explicit `c.user_id = auth.uid()` filter inside the wrapper so
--    the view is still tenant-safe even though RLS no longer cascades from
--    the underlying contacts table.
-- 4. Re-grant SELECT on the wrapper to anon and authenticated.
--
-- PREREQ: Pieces 1, 2, and 3 must have run successfully.
--
-- HOW TO RUN:
--   Open Supabase SQL Editor. Paste this file. Run.
-- ============================================================

BEGIN;

-- 1. Revoke direct PostgREST / client access to the materialized view
REVOKE ALL ON public.agent_relationship_health FROM anon;
REVOKE ALL ON public.agent_relationship_health FROM authenticated;
REVOKE ALL ON public.agent_relationship_health FROM PUBLIC;

-- 2. Keep service_role able to read the MV for admin tooling and
--    future maintenance queries. The SECURITY DEFINER refresh function
--    operates as its owner and does not depend on this grant, but we
--    make the intent explicit here.
GRANT SELECT ON public.agent_relationship_health TO service_role;

-- 3. Rebuild the wrapper view so it runs as owner and self-filters by
--    auth.uid(). Column list is identical to piece 3.
CREATE OR REPLACE VIEW public.agent_health
  WITH (security_invoker = false) AS
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

FROM public.contacts c
LEFT JOIN public.agent_relationship_health arh ON arh.contact_id = c.id
WHERE c.deleted_at IS NULL
  AND c.user_id = auth.uid();

-- 4. Re-expose the wrapper. CREATE OR REPLACE usually preserves grants
--    but we restate them here for clarity and to be idempotent.
GRANT SELECT ON public.agent_health TO anon;
GRANT SELECT ON public.agent_health TO authenticated;

COMMIT;


-- ============================================================
-- VERIFY (run after commit, as an authenticated user)
-- ============================================================
--
-- 1. Wrapper still returns the current user's rows:
--    SELECT count(*) FROM public.agent_health;
--    -- should return a positive number scoped to auth.uid()
--
-- 2. Direct access to the MV is now blocked:
--    SELECT count(*) FROM public.agent_relationship_health;
--    -- should error: permission denied for materialized view
--    --               agent_relationship_health
--
-- 3. Confirm PostgREST refuses the direct endpoint:
--    curl -H "apikey: <anon-key>" \
--         -H "Authorization: Bearer <authenticated-jwt>" \
--         "$SUPABASE_URL/rest/v1/agent_relationship_health"
--    -- should return 401 or 404 depending on PostgREST role masking.
--
-- ============================================================


-- ============================================================
-- ROLLBACK (if the dashboard breaks unexpectedly)
-- ============================================================
--
-- BEGIN;
-- GRANT SELECT ON public.agent_relationship_health TO anon;
-- GRANT SELECT ON public.agent_relationship_health TO authenticated;
-- CREATE OR REPLACE VIEW public.agent_health
--   WITH (security_invoker = true) AS
-- SELECT
--   c.id AS contact_id,
--   c.user_id,
--   COALESCE(NULLIF(c.health_score, 0), arh.computed_health_score, 0) AS health_score,
--   CASE
--     WHEN c.health_score IS NOT NULL AND c.health_score > 0 THEN 'manual'
--     WHEN arh.computed_health_score IS NOT NULL THEN 'computed'
--     ELSE 'none'
--   END AS health_score_source,
--   arh.computed_health_score, arh.recency_score, arh.deal_trend_score,
--   arh.frequency_score, arh.responsiveness_score, arh.trend_direction,
--   arh.days_since_contact, arh.last_contact_at, arh.total_interactions,
--   arh.interactions_30d, arh.deals_closed_90d, arh.active_deals,
--   arh.computed_at AS health_computed_at
-- FROM public.contacts c
-- LEFT JOIN public.agent_relationship_health arh ON arh.contact_id = c.id
-- WHERE c.deleted_at IS NULL;
-- COMMIT;
--
-- ============================================================
