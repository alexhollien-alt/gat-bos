-- ============================================================
-- SLICE 7A TASK B-19 -- relationship_health_touchpoint_weights READ RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 19 of 21
--
-- Replaces email-based rhw_alex_read (SELECT) with column-based
-- rhw_user_isolation_read. user_id was added by suppl-14 add-column
-- migration (uuid NOT NULL, default auth.uid(), backfilled from
-- OWNER_USER_ID). MCP pre-flight 2026-04-29: data_type=uuid,
-- is_nullable=NO, default=auth.uid(), 4 rows, 0 NULL user_ids.
--
-- Applied via Supabase MCP (Rule 23 override in effect for B-12 onward).
-- Paired write policy lands in B-20 (rhw_alex_write -> rhw_user_isolation_write).
--
-- Rollback (paired):
--   DROP POLICY IF EXISTS rhw_user_isolation_read ON public.relationship_health_touchpoint_weights;
--   CREATE POLICY rhw_alex_read
--     ON public.relationship_health_touchpoint_weights
--     FOR SELECT
--     TO authenticated
--     USING ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com');
-- ============================================================

BEGIN;

ALTER TABLE public.relationship_health_touchpoint_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rhw_alex_read ON public.relationship_health_touchpoint_weights;

CREATE POLICY rhw_user_isolation_read
  ON public.relationship_health_touchpoint_weights
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY rhw_user_isolation_read ON public.relationship_health_touchpoint_weights IS
  'Slice 7A: replaces email-based rhw_alex_read; column user_id checked against auth.uid().';

COMMIT;
