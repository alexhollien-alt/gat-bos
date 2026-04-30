-- Slice 7A Task 0b-suppl-15 -- templates.user_id add-column (idempotent)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.templates
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.templates ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.templates ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.templates
  DROP CONSTRAINT IF EXISTS templates_user_id_fkey;

ALTER TABLE public.templates
  ADD CONSTRAINT templates_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS templates_user_id_idx
  ON public.templates (user_id);

COMMIT;
