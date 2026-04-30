-- ============================================================
-- SLICE 7A TASK B-20 -- relationship_health_touchpoint_weights WRITE RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 20 of 21
--
-- Replaces email-based rhw_alex_write (FOR ALL) with column-based
-- rhw_user_isolation_write. Paired with B-19 read policy. Together
-- they fully retire email-JWT isolation on relationship_health_touchpoint_weights.
--
-- Applied via Supabase MCP (Rule 23 override in effect for B-12 onward).
--
-- Rollback (paired):
--   DROP POLICY IF EXISTS rhw_user_isolation_write ON public.relationship_health_touchpoint_weights;
--   CREATE POLICY rhw_alex_write
--     ON public.relationship_health_touchpoint_weights
--     FOR ALL
--     TO authenticated
--     USING      ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com')
--     WITH CHECK ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com');
-- ============================================================

BEGIN;

ALTER TABLE public.relationship_health_touchpoint_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rhw_alex_write ON public.relationship_health_touchpoint_weights;

CREATE POLICY rhw_user_isolation_write
  ON public.relationship_health_touchpoint_weights
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY rhw_user_isolation_write ON public.relationship_health_touchpoint_weights IS
  'Slice 7A: replaces email-based rhw_alex_write; column user_id checked against auth.uid().';

COMMIT;
