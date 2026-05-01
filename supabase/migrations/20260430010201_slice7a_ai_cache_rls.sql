-- Slice 7A Task B-1 -- ai_cache RLS rewrite (forward, mirrored from paste)
-- Replaces email-based alex_ai_cache_all with column-based
-- ai_cache_user_isolation. Pre-req: 20260427300100_slice7a_ai_cache_user_id.sql.
-- Paired rollback in same slice; see plan ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md.

BEGIN;

ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_ai_cache_all ON public.ai_cache;

CREATE POLICY ai_cache_user_isolation
  ON public.ai_cache
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY ai_cache_user_isolation ON public.ai_cache IS
  'Slice 7A: replaces email-based alex_ai_cache_all; column user_id checked against auth.uid().';

COMMIT;

-- Verification (run after commit):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.ai_cache'::regclass;
--   -- expect: ai_cache_user_isolation (and ONLY that)
