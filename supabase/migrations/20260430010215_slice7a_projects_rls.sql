-- ============================================================
-- SLICE 7A TASK B-14 -- projects RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 14 of 21
--
-- Replaces email-based alex_projects_all with column-based
-- projects_user_isolation. user_id was added by suppl-11 add-column
-- migration (uuid NOT NULL, default auth.uid(), backfilled from
-- OWNER_USER_ID). MCP pre-flight 2026-04-29: data_type=uuid,
-- is_nullable=NO, default=auth.uid(), 10 rows, 0 NULL user_ids.
--
-- Mid-slice smoke gate (#12 cluster) deferred per skip-mid-slice authorization.
--
-- Paired rollback: PASTE-INTO-SUPABASE-7a-projects-rls-rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_projects_all ON public.projects;

CREATE POLICY projects_user_isolation
  ON public.projects
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY projects_user_isolation ON public.projects IS
  'Slice 7A: replaces email-based alex_projects_all; column user_id checked against auth.uid().';

COMMIT;
