-- ============================================================
-- SLICE 7A TASK B-16 -- relationship_health_config WRITE RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 16 of 21
--
-- Replaces email-based rhc_alex_write (FOR ALL) with column-based
-- rhc_user_isolation_write. Paired with B-15 read policy. Together
-- they fully retire email-JWT isolation on relationship_health_config.
--
-- Applied via Supabase MCP (Rule 23 override in effect for B-12 onward).
--
-- Rollback (paired):
--   DROP POLICY IF EXISTS rhc_user_isolation_write ON public.relationship_health_config;
--   CREATE POLICY rhc_alex_write
--     ON public.relationship_health_config
--     FOR ALL
--     TO authenticated
--     USING      ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com')
--     WITH CHECK ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com');
-- ============================================================

BEGIN;

ALTER TABLE public.relationship_health_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rhc_alex_write ON public.relationship_health_config;

CREATE POLICY rhc_user_isolation_write
  ON public.relationship_health_config
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY rhc_user_isolation_write ON public.relationship_health_config IS
  'Slice 7A: replaces email-based rhc_alex_write; column user_id checked against auth.uid().';

COMMIT;
