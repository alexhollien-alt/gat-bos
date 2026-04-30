-- ============================================================
-- SLICE 7A TASK B-15 -- relationship_health_config READ RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 15 of 21
--
-- Replaces email-based rhc_alex_read (SELECT) with column-based
-- rhc_user_isolation_read. user_id was added by suppl-12 add-column
-- migration (uuid NOT NULL, default auth.uid(), backfilled from
-- OWNER_USER_ID). MCP pre-flight 2026-04-29: data_type=uuid,
-- is_nullable=NO, default=auth.uid(), 1 row, 0 NULL user_ids.
--
-- Mid-slice smoke gate (#15 cluster) deferred per skip-mid-slice authorization.
--
-- Applied via Supabase MCP (Rule 23 override in effect for B-12 onward).
-- Paired write policy lands in B-16 (rhc_alex_write -> rhc_user_isolation_write).
--
-- Rollback (paired):
--   DROP POLICY IF EXISTS rhc_user_isolation_read ON public.relationship_health_config;
--   CREATE POLICY rhc_alex_read
--     ON public.relationship_health_config
--     FOR SELECT
--     TO authenticated
--     USING ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com');
-- ============================================================

BEGIN;

ALTER TABLE public.relationship_health_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rhc_alex_read ON public.relationship_health_config;

CREATE POLICY rhc_user_isolation_read
  ON public.relationship_health_config
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY rhc_user_isolation_read ON public.relationship_health_config IS
  'Slice 7A: replaces email-based rhc_alex_read; column user_id checked against auth.uid().';

COMMIT;
