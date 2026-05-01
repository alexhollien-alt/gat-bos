-- ============================================================
-- Slice 7A.5 -- Reconstructed prod mirror
-- Source: production schema_migrations row at version 20260430064146
-- Reconstructed: 2026-04-30
-- This file is byte-equivalent (or semantically equivalent) to the
-- DDL applied to production at 20260430064146. Reconstructed as part of
-- migration history reconciliation because the original local file
-- was missing.
-- ============================================================

-- SLICE 7A B-19 -- relationship_health_touchpoint_weights READ RLS rewrite (forward)
ALTER TABLE public.relationship_health_touchpoint_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rhw_alex_read ON public.relationship_health_touchpoint_weights;
CREATE POLICY rhw_user_isolation_read
  ON public.relationship_health_touchpoint_weights
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
COMMENT ON POLICY rhw_user_isolation_read ON public.relationship_health_touchpoint_weights IS
  'Slice 7A: replaces email-based rhw_alex_read; column user_id checked against auth.uid().';
