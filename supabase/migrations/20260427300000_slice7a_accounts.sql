-- Slice 7A Task 0b -- accounts table foundation (forward)
-- Creates public.accounts, seeds Alex's row, enables RLS, applies owner policies.
-- OWNER_USER_ID resolved at plan time: b735d691-4d86-4e31-9fd3-c2257822dca3

BEGIN;

CREATE TABLE public.accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  owner_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL
);

CREATE INDEX accounts_owner_user_id_active_idx
  ON public.accounts (owner_user_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER accounts_set_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- SELECT policy: owner reads own account row.
-- Columns covered (audit clarity): id, name, slug, owner_user_id, created_at, updated_at, deleted_at.
CREATE POLICY accounts_owner_select
  ON public.accounts
  FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

COMMENT ON POLICY accounts_owner_select ON public.accounts IS
  'Slice 7A: owner reads own account row. Columns: id, name, slug, owner_user_id, created_at, updated_at, deleted_at.';

-- UPDATE policy: owner mutates own account row.
-- Columns covered: name, slug, owner_user_id, deleted_at.
CREATE POLICY accounts_owner_update
  ON public.accounts
  FOR UPDATE
  TO authenticated
  USING      (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

COMMENT ON POLICY accounts_owner_update ON public.accounts IS
  'Slice 7A: owner updates own account row. Columns: name, slug, owner_user_id, deleted_at.';

-- DELETE policy: owner soft/hard deletes own account row.
CREATE POLICY accounts_owner_delete
  ON public.accounts
  FOR DELETE
  TO authenticated
  USING (owner_user_id = auth.uid());

COMMENT ON POLICY accounts_owner_delete ON public.accounts IS
  'Slice 7A: owner deletes own account row. Soft delete preferred (set deleted_at).';

-- INSERT not policy-permitted. Account creation lives in 7B+ admin tooling.

INSERT INTO public.accounts (name, slug, owner_user_id)
VALUES ('Alex Hollien', 'alex-hollien', 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid);

COMMIT;

-- Verification (run after commit):
--   SELECT id, name, slug, owner_user_id FROM public.accounts;
--   SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.accounts'::regclass ORDER BY polname;
