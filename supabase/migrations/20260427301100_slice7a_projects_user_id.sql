-- Slice 7A Task 0b-suppl-11 -- projects.user_id add-column (forward, idempotent)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- Repair pattern: IF NOT EXISTS / DROP CONSTRAINT IF EXISTS so re-runs are safe.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.projects
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.projects ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.projects ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_user_id_fkey;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS projects_user_id_idx
  ON public.projects (user_id);

COMMIT;

-- Verification (run after commit):
--   SELECT count(*) FROM public.projects WHERE user_id IS NULL;  -- expect 0
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='projects' AND column_name='user_id';
--   -- expect 'auth.uid()'
