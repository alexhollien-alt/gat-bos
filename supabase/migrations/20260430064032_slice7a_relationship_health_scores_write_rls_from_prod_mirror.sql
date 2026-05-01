-- ============================================================
-- Slice 7A.5 -- Reconstructed prod mirror
-- Source: production schema_migrations row at version 20260430064032
-- Reconstructed: 2026-04-30
-- This file is byte-equivalent (or semantically equivalent) to the
-- DDL applied to production at 20260430064032. Reconstructed as part of
-- migration history reconciliation because the original local file
-- was missing.
-- ============================================================

-- ============================================================
-- SLICE 7A TASK B-18 -- relationship_health_scores WRITE RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 18 of 21
--
-- Replaces email-based rhs_alex_write (FOR ALL) with column-based
-- rhs_user_isolation_write. Paired with B-17 read policy. Together
-- they fully retire email-JWT isolation on relationship_health_scores.
--
-- Applied via Supabase MCP (Rule 23 override in effect for B-12 onward).
--
-- Rollback (paired):
--   DROP POLICY IF EXISTS rhs_user_isolation_write ON public.relationship_health_scores;
--   CREATE POLICY rhs_alex_write
--     ON public.relationship_health_scores
--     FOR ALL
--     TO authenticated
--     USING      ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com')
--     WITH CHECK ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com');
-- ============================================================

ALTER TABLE public.relationship_health_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rhs_alex_write ON public.relationship_health_scores;

CREATE POLICY rhs_user_isolation_write
  ON public.relationship_health_scores
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY rhs_user_isolation_write ON public.relationship_health_scores IS
  'Slice 7A: replaces email-based rhs_alex_write; column user_id checked against auth.uid().';
