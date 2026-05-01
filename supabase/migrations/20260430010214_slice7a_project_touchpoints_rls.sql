-- ============================================================
-- SLICE 7A TASK B-13 -- project_touchpoints RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 13 of 21
--
-- Replaces email-based alex_touchpoints_all with column-based
-- project_touchpoints_user_isolation. user_id pre-existed as uuid
-- NOT NULL with backfill from slice 5b -- no add-column or type-fix
-- needed (MCP pre-flight 2026-04-29: data_type=uuid, is_nullable=NO,
-- 4 rows, 0 NULL user_ids).
--
-- Mid-slice smoke gate (#12 cluster) deferred per skip-mid-slice authorization.
--
-- Paired rollback: PASTE-INTO-SUPABASE-7a-project_touchpoints-rls-rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE public.project_touchpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_touchpoints_all ON public.project_touchpoints;

CREATE POLICY project_touchpoints_user_isolation
  ON public.project_touchpoints
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY project_touchpoints_user_isolation ON public.project_touchpoints IS
  'Slice 7A: replaces email-based alex_touchpoints_all; column user_id checked against auth.uid().';

COMMIT;
