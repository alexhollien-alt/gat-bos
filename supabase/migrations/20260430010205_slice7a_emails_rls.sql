-- Slice 7A Task B-5 -- emails RLS rewrite (forward, mirrored from paste)
-- Replaces email-based alex_emails_all with column-based
-- emails_user_isolation. user_id was added in Phase A
-- (Task 0b-suppl-4 / 20260427300400_slice7a_emails_user_id.sql).
-- Paired rollback in same slice; see plan ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md.

BEGIN;

ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_emails_all ON public.emails;

CREATE POLICY emails_user_isolation
  ON public.emails
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY emails_user_isolation ON public.emails IS
  'Slice 7A: replaces email-based alex_emails_all; column user_id checked against auth.uid().';

COMMIT;

-- Verification (run after commit):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.emails'::regclass;
--   -- expect: emails_user_isolation (and ONLY that)
