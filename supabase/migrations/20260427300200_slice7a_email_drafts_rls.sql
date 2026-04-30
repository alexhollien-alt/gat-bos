-- Slice 7A Task B-4 -- email_drafts RLS rewrite (forward, mirrored from paste)
-- Replaces email-based alex_drafts_all with column-based
-- email_drafts_user_isolation. user_id was added in Phase A
-- (Task 0b-suppl-3 / 20260427300300_slice7a_email_drafts_user_id.sql).
-- Paired rollback in same slice; see plan ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md.

BEGIN;

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_drafts_all ON public.email_drafts;

CREATE POLICY email_drafts_user_isolation
  ON public.email_drafts
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY email_drafts_user_isolation ON public.email_drafts IS
  'Slice 7A: replaces email-based alex_drafts_all; column user_id checked against auth.uid().';

COMMIT;

-- Verification (run after commit):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.email_drafts'::regclass;
--   -- expect: email_drafts_user_isolation (and ONLY that)
