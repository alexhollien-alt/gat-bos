-- Slice 7A Task 0b-suppl-2 -- attendees.user_id add-column (forward)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.attendees ADD COLUMN user_id uuid;

UPDATE public.attendees
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.attendees ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.attendees ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.attendees
  ADD CONSTRAINT attendees_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX attendees_user_id_idx ON public.attendees (user_id);

COMMIT;

-- Verification (run after commit):
--   SELECT count(*) FROM public.attendees WHERE user_id IS NULL;  -- expect 0
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='attendees' AND column_name='user_id';
--   -- expect 'auth.uid()'
