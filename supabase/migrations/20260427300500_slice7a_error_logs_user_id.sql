-- Slice 7A Task 0b-suppl-5 -- error_logs.user_id add-column (forward)
-- Mirrors PASTE-INTO-SUPABASE-7a-error_logs-add-user-id.sql executed against
-- Supabase. Pattern: NULLABLE add -> backfill from OWNER_USER_ID ->
-- SET NOT NULL -> SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.error_logs ADD COLUMN user_id uuid;

UPDATE public.error_logs
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.error_logs ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.error_logs ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.error_logs
  ADD CONSTRAINT error_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX error_logs_user_id_idx ON public.error_logs (user_id);

COMMIT;
