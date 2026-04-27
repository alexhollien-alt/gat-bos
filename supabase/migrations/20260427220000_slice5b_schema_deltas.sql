-- Slice 5B Task 7b -- Schema deltas (consolidated)
--
-- Mirror of paste-file PASTE-INTO-SUPABASE-slice5b-schema-deltas.sql, executed
-- in Supabase SQL Editor on 2026-04-27. This file makes the deltas reproducible
-- from a clean DB rebuild. Idempotent: ADD COLUMN IF NOT EXISTS, ADD VALUE
-- IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, NOT-NULL guard via DO block.
--
-- Covers:
--   1. project_touchpoints: due_at, deleted_at, user_id (NOT NULL after
--      backfill to alex@alexhollienco.com), last_reminded_at
--   2. project_touchpoints: partial indexes on (due_at), (last_reminded_at)
--      WHERE deleted_at IS NULL
--   3. project_touchpoint_type enum: ADD VALUE 'listing_setup' (G2 path-a)
--   4. tasks: ADD project_id uuid REFERENCES projects(id) ON DELETE SET NULL
--      + partial index WHERE deleted_at IS NULL AND project_id IS NOT NULL
--
-- RLS unchanged: project_touchpoints.alex_touchpoints_all and tasks.users-manage-own
-- both pre-exist (audited 2026-04-27).
--
-- Postgres restriction: ALTER TYPE ... ADD VALUE must run outside any
-- transaction that later references the new value. We add it first
-- (autocommit), then wrap the remaining deltas in BEGIN/COMMIT.

ALTER TYPE public.project_touchpoint_type ADD VALUE IF NOT EXISTS 'listing_setup';

BEGIN;

ALTER TABLE public.project_touchpoints
  ADD COLUMN IF NOT EXISTS due_at timestamptz NULL;

ALTER TABLE public.project_touchpoints
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

ALTER TABLE public.project_touchpoints
  ADD COLUMN IF NOT EXISTS user_id uuid NULL REFERENCES auth.users(id);

ALTER TABLE public.project_touchpoints
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz NULL;

UPDATE public.project_touchpoints
SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'
WHERE user_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_touchpoints'
      AND column_name = 'user_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.project_touchpoints ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_touchpoints_due_at
  ON public.project_touchpoints (due_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_touchpoints_last_reminded_at
  ON public.project_touchpoints (last_reminded_at)
  WHERE deleted_at IS NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id uuid NULL REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_id
  ON public.tasks (project_id)
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;

COMMIT;
