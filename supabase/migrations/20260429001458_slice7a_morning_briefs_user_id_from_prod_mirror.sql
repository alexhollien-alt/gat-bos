-- ============================================================
-- Slice 7A.5 -- Reconstructed prod mirror
-- Source: production schema_migrations row at version 20260429001458
-- Reconstructed: 2026-04-30
-- This file is byte-equivalent (or semantically equivalent) to the
-- DDL applied to production at 20260429001458. Reconstructed as part of
-- migration history reconciliation because the original local file
-- was missing.
-- ============================================================

ALTER TABLE public.morning_briefs ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.morning_briefs
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.morning_briefs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.morning_briefs ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.morning_briefs
  DROP CONSTRAINT IF EXISTS morning_briefs_user_id_fkey;

ALTER TABLE public.morning_briefs
  ADD CONSTRAINT morning_briefs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS morning_briefs_user_id_idx
  ON public.morning_briefs (user_id);
