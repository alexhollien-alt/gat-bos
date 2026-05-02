-- Slice 7C / Task 1: agent_invites table + RLS
--
-- Surface: magic-link invitations sent by an account-owner (Alex) to one of
-- their agent contacts. The plaintext token is sha256-hashed for storage
-- (sha256 only, no HMAC -- per OQ#4: single-use + expires_at + unique partial
-- index already mitigate replay at this scale).
--
-- Anon path: ONLY via redeem_agent_invite() RPC (next migration). Direct
-- anon SELECT/INSERT/UPDATE/DELETE on this table is denied.
--
-- Account-owner path: standard 7B account-scoped RLS pattern
-- (account_id IN SELECT FROM accounts WHERE owner_user_id = auth.uid()).

BEGIN;

-- 1. Table
CREATE TABLE IF NOT EXISTS public.agent_invites (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            uuid NOT NULL REFERENCES public.accounts(id),
  contact_id            uuid NOT NULL REFERENCES public.contacts(id),
  token_hash            text NOT NULL,
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  redeemed_at           timestamptz NULL,
  redeemed_by_user_id   uuid NULL REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz NULL
);

-- 2. Indexes
-- Unique partial index on token_hash among active, unredeemed rows: prevents
-- duplicate token issuance and accelerates the redeem RPC's single-row lookup.
CREATE UNIQUE INDEX IF NOT EXISTS agent_invites_token_hash_active_uniq
  ON public.agent_invites (token_hash)
  WHERE deleted_at IS NULL AND redeemed_at IS NULL;

-- Account/contact composite for the invite-list view that an account-owner
-- might render (e.g., "all outstanding invites for Julie's contact row").
CREATE INDEX IF NOT EXISTS agent_invites_account_contact_idx
  ON public.agent_invites (account_id, contact_id)
  WHERE deleted_at IS NULL;

-- 3. updated_at trigger (mirrors 7B pattern)
CREATE OR REPLACE FUNCTION public.tg_agent_invites_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_invites_set_updated_at ON public.agent_invites;
CREATE TRIGGER agent_invites_set_updated_at
  BEFORE UPDATE ON public.agent_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_agent_invites_set_updated_at();

-- 4. Enable RLS
ALTER TABLE public.agent_invites ENABLE ROW LEVEL SECURITY;

-- 5. Policies (account-scoped owner; anon denied via absence of policy)
DROP POLICY IF EXISTS agent_invites_account_select ON public.agent_invites;
DROP POLICY IF EXISTS agent_invites_account_insert ON public.agent_invites;
DROP POLICY IF EXISTS agent_invites_account_update ON public.agent_invites;
DROP POLICY IF EXISTS agent_invites_account_delete ON public.agent_invites;

CREATE POLICY agent_invites_account_select
  ON public.agent_invites
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY agent_invites_account_insert
  ON public.agent_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY agent_invites_account_update
  ON public.agent_invites
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

CREATE POLICY agent_invites_account_delete
  ON public.agent_invites
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts
       WHERE owner_user_id = auth.uid()
         AND deleted_at IS NULL
    )
  );

-- 6. Explicit anon denial (defense in depth: RLS without an anon policy
-- already denies, but explicit REVOKE makes the contract obvious).
REVOKE ALL ON public.agent_invites FROM anon;

COMMIT;
