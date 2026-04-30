-- Slice 7A Task 0b-suppl-13 -- relationship_health_scores.user_id add-column (idempotent)
-- Pattern: NULLABLE add -> backfill from OWNER_USER_ID -> SET NOT NULL ->
--          SET DEFAULT auth.uid() -> FK auth.users -> index.
-- OWNER_USER_ID: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

ALTER TABLE public.relationship_health_scores ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.relationship_health_scores
   SET user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
 WHERE user_id IS NULL;

ALTER TABLE public.relationship_health_scores ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.relationship_health_scores ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.relationship_health_scores
  DROP CONSTRAINT IF EXISTS relationship_health_scores_user_id_fkey;

ALTER TABLE public.relationship_health_scores
  ADD CONSTRAINT relationship_health_scores_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS relationship_health_scores_user_id_idx
  ON public.relationship_health_scores (user_id);

COMMIT;
