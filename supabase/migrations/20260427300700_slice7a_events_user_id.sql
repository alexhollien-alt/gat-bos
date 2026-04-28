-- Slice 7A Task 0b-suppl-7 -- events.user_id add-column (forward)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.events ADD COLUMN user_id uuid;

UPDATE public.events
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.events ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.events ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.events
  ADD CONSTRAINT events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX events_user_id_idx ON public.events (user_id);

COMMIT;

-- Verification (run after commit):
--   SELECT count(*) FROM public.events WHERE user_id IS NULL;  -- expect 0
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='events' AND column_name='user_id';
--   -- expect 'auth.uid()'
