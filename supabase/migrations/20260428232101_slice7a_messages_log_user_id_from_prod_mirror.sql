-- ============================================================
-- Slice 7A.5 -- Reconstructed prod mirror
-- Source: production schema_migrations row at version 20260428232101
-- Reconstructed: 2026-04-30
-- This file is byte-equivalent (or semantically equivalent) to the
-- DDL applied to production at 20260428232101. Reconstructed as part of
-- migration history reconciliation because the original local file
-- was missing.
-- ============================================================

ALTER TABLE public.messages_log ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.messages_log
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.messages_log ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.messages_log ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.messages_log
  DROP CONSTRAINT IF EXISTS messages_log_user_id_fkey;

ALTER TABLE public.messages_log
  ADD CONSTRAINT messages_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS messages_log_user_id_idx
  ON public.messages_log (user_id);
