-- ============================================================
-- SLICE 7A TASK B-10 -- messages_log RLS rewrite (forward)
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   B (RLS rewrites), policy 10 of 21
--
-- Replaces email-based alex_messages_log_all with column-based
-- messages_log_user_isolation. user_id was added in Phase A
-- (20260427300900_slice7a_messages_log_user_id.sql).
--
-- Mid-slice smoke gate (#9 cluster) deferred per skip-mid-slice authorization.
--
-- Paired rollback: PASTE-INTO-SUPABASE-7a-messages_log-rls-rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE public.messages_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_messages_log_all ON public.messages_log;

CREATE POLICY messages_log_user_isolation
  ON public.messages_log
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY messages_log_user_isolation ON public.messages_log IS
  'Slice 7A: replaces email-based alex_messages_log_all; column user_id checked against auth.uid().';

COMMIT;

-- ============================================================
-- Verify (after paste):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.messages_log'::regclass;
--   -- expect: messages_log_user_isolation (and ONLY that)
-- ============================================================
