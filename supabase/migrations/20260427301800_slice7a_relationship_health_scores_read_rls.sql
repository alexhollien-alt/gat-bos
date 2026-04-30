-- ============================================================
-- SLICE 7A TASK B-17 -- relationship_health_scores READ RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 17 of 21
--
-- Replaces email-based rhs_alex_read (SELECT) with column-based
-- rhs_user_isolation_read. user_id was added by suppl-13 add-column
-- migration (uuid NOT NULL, default auth.uid(), backfilled from
-- OWNER_USER_ID). MCP pre-flight 2026-04-29: data_type=uuid,
-- is_nullable=NO, default=auth.uid(), 131 rows, 0 NULL user_ids.
--
-- Applied via Supabase MCP (Rule 23 override in effect for B-12 onward).
-- Paired write policy lands in B-18 (rhs_alex_write -> rhs_user_isolation_write).
--
-- Rollback (paired):
--   DROP POLICY IF EXISTS rhs_user_isolation_read ON public.relationship_health_scores;
--   CREATE POLICY rhs_alex_read
--     ON public.relationship_health_scores
--     FOR SELECT
--     TO authenticated
--     USING ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com');
-- ============================================================

BEGIN;

ALTER TABLE public.relationship_health_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rhs_alex_read ON public.relationship_health_scores;

CREATE POLICY rhs_user_isolation_read
  ON public.relationship_health_scores
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY rhs_user_isolation_read ON public.relationship_health_scores IS
  'Slice 7A: replaces email-based rhs_alex_read; column user_id checked against auth.uid().';

COMMIT;
