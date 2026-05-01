-- Slice 7A Task B-3 -- attendees RLS rewrite (forward, mirrored from paste)
-- Replaces email-based alex_attendees_all with column-based
-- attendees_user_isolation. user_id was added in Phase A
-- (Task 0b-suppl-2 / 20260427300200_slice7a_attendees_user_id.sql).
-- Paired rollback in same slice; see plan ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md.

BEGIN;

ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_attendees_all ON public.attendees;

CREATE POLICY attendees_user_isolation
  ON public.attendees
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY attendees_user_isolation ON public.attendees IS
  'Slice 7A: replaces email-based alex_attendees_all; column user_id checked against auth.uid().';

COMMIT;

-- Verification (run after commit):
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.attendees'::regclass;
--   -- expect: attendees_user_isolation (and ONLY that)
