-- Slice 7A Task B-2 -- ai_usage_log RLS rewrite (forward, mirrored from paste)
-- Replaces email-based alex_ai_usage_log_all with column-based
-- ai_usage_log_user_isolation. user_id was pre-existing on this table
-- (one of 3 tables with user_id per pre-flight finding 3.d -- no Phase A
-- user_id add-column migration needed).
-- Paired rollback in same slice; see plan ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md.

BEGIN;

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_ai_usage_log_all ON public.ai_usage_log;

CREATE POLICY ai_usage_log_user_isolation
  ON public.ai_usage_log
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY ai_usage_log_user_isolation ON public.ai_usage_log IS
  'Slice 7A: replaces email-based alex_ai_usage_log_all; column user_id checked against auth.uid().';

COMMIT;

-- Verification (run after commit):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.ai_usage_log'::regclass;
--   -- expect: ai_usage_log_user_isolation (and ONLY that)
