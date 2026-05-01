-- ============================================================
-- Slice 7A.5 -- Reconstructed prod mirror
-- Source: production schema_migrations row at version 20260430064522
-- Reconstructed: 2026-04-30
-- This file is byte-equivalent (or semantically equivalent) to the
-- DDL applied to production at 20260430064522. Reconstructed as part of
-- migration history reconciliation because the original local file
-- was missing.
-- ============================================================

ALTER TABLE public.message_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alex_message_events_all ON public.message_events;
CREATE POLICY message_events_user_isolation
  ON public.message_events
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
COMMENT ON POLICY message_events_user_isolation ON public.message_events IS
  'Slice 7A: replaces email-based alex_message_events_all; column user_id checked against auth.uid().';
NOTIFY pgrst, 'reload schema';
