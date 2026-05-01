-- ============================================================
-- Slice 7A.5 -- Reconstructed prod mirror
-- Source: production schema_migrations row at version 20260430064244
-- Reconstructed: 2026-04-30
-- This file is byte-equivalent (or semantically equivalent) to the
-- DDL applied to production at 20260430064244. Reconstructed as part of
-- migration history reconciliation because the original local file
-- was missing.
-- ============================================================

-- SLICE 7A B-21 -- templates RLS rewrite (forward) -- final RLS rewrite
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alex_templates_all ON public.templates;
CREATE POLICY templates_user_isolation
  ON public.templates
  FOR ALL
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
COMMENT ON POLICY templates_user_isolation ON public.templates IS
  'Slice 7A: replaces email-based alex_templates_all; column user_id checked against auth.uid().';
