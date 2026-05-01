-- Slice 7C / Task 2: redeem_agent_invite RPC
--
-- SECURITY DEFINER, anon-callable. Per OQ#3 (b): RPC validates only -- it
-- consumes the invite (marks redeemed_at) and returns the email + slug + IDs
-- needed for the route handler to hand off to a Supabase Auth magic-link
-- callback. The RPC does NOT mint sessions, set cookies, or impersonate users.
--
-- Per OQ#4: token hashed sha256 only (hashing happens in the Node.js route
-- handler before invoking the RPC; pgcrypto is not installed in prod, and
-- doing the hash in Node keeps the plaintext token off the database server
-- entirely). The RPC accepts the precomputed hash.
--
-- Single-use semantics: row-level FOR UPDATE lock + redeemed_at filter +
-- unique partial index on token_hash. Concurrent redemption attempts on the
-- same hash will serialize; the second loses the race and gets the
-- "Invalid, expired, or already redeemed" exception.

BEGIN;

CREATE OR REPLACE FUNCTION public.redeem_agent_invite(p_token_hash text)
RETURNS TABLE (
  email      text,
  slug       text,
  account_id uuid,
  contact_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_id  uuid;
  v_account_id uuid;
  v_contact_id uuid;
  v_email      text;
  v_slug       text;
BEGIN
  -- 1. Lock + validate (single-use enforced by FOR UPDATE + redeemed_at filter)
  SELECT ai.id, ai.account_id, ai.contact_id
    INTO v_invite_id, v_account_id, v_contact_id
    FROM public.agent_invites ai
   WHERE ai.token_hash  = p_token_hash
     AND ai.deleted_at  IS NULL
     AND ai.redeemed_at IS NULL
     AND ai.expires_at  > now()
   FOR UPDATE;

  IF v_invite_id IS NULL THEN
    RAISE EXCEPTION 'Invalid, expired, or already redeemed invite'
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Consume (mark redeemed; redeemed_by_user_id stays NULL until the
  --    post-auth callback can bind auth.uid() to the row -- out of scope here
  --    to keep SECURITY DEFINER blast radius narrow per OQ#3)
  UPDATE public.agent_invites
     SET redeemed_at = now()
   WHERE id = v_invite_id;

  -- 3. Resolve email + slug from contacts (the agent contact owns both)
  SELECT c.email, c.slug
    INTO v_email, v_slug
    FROM public.contacts c
   WHERE c.id = v_contact_id
     AND c.deleted_at IS NULL;

  IF v_email IS NULL OR v_slug IS NULL THEN
    -- Defensive: contact was soft-deleted between invite issuance and
    -- redemption, or never had email/slug populated. Fail closed.
    RAISE EXCEPTION 'Invite contact is no longer redeemable'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY SELECT v_email, v_slug, v_account_id, v_contact_id;
END;
$$;

-- 4. Privilege scoping: REVOKE everything, then GRANT EXECUTE to anon and
-- authenticated. anon is required because the user is not yet signed in
-- when the redeem route fires.
REVOKE ALL ON FUNCTION public.redeem_agent_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_agent_invite(text) TO anon, authenticated;

COMMIT;
