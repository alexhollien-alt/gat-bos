-- ============================================================
-- SLICE 7A TASK B-6 -- error_logs RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 6 of 21
--
-- Replaces email-based alex_error_logs_all with column-based
-- error_logs_user_isolation. user_id was added in Phase A
-- (Task 0b-suppl-5 / 20260427300500_slice7a_error_logs_user_id.sql).
--
-- *** SMOKE GATE after this commit (#6 of 21) ***
--
-- Paired rollback: PASTE-INTO-SUPABASE-7a-error_logs-rls-rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_error_logs_all ON public.error_logs;

CREATE POLICY error_logs_user_isolation
  ON public.error_logs
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY error_logs_user_isolation ON public.error_logs IS
  'Slice 7A: replaces email-based alex_error_logs_all; column user_id checked against auth.uid().';

COMMIT;

-- ============================================================
-- Verify (after paste):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.error_logs'::regclass;
--   -- expect: error_logs_user_isolation (and ONLY that)
-- ============================================================
