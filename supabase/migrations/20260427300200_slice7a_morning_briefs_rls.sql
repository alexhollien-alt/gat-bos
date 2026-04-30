-- ============================================================
-- SLICE 7A TASK B-11 -- morning_briefs RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 11 of 21
--
-- Replaces email-based alex_morning_briefs_all with column-based
-- morning_briefs_user_isolation. user_id was added in Phase A
-- (0b-suppl-10 morning_briefs.user_id add-column).
--
-- Mid-slice smoke gate (#12 cluster) deferred per skip-mid-slice authorization.
--
-- Paired rollback: PASTE-INTO-SUPABASE-7a-morning_briefs-rls-rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE public.morning_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_morning_briefs_all ON public.morning_briefs;

CREATE POLICY morning_briefs_user_isolation
  ON public.morning_briefs
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY morning_briefs_user_isolation ON public.morning_briefs IS
  'Slice 7A: replaces email-based alex_morning_briefs_all; column user_id checked against auth.uid().';

COMMIT;

-- ============================================================
-- Verify (after paste):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.morning_briefs'::regclass;
--   -- expect: morning_briefs_user_isolation (and ONLY that)
-- ============================================================
