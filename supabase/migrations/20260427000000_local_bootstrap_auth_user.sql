-- Local bootstrap: insert Alex's auth.users row so that the slice7a_accounts
-- seed (next migration in chronological order) can satisfy its FK to
-- auth.users(id).
--
-- Why this exists: a fresh local Supabase stack starts with an empty
-- auth.users table. The 20260427300000_slice7a_accounts migration hardcodes
-- INSERT INTO public.accounts (...) VALUES (..., 'b735d691-...'::uuid) with
-- a FK to auth.users(id). Without this bootstrap, `supabase db reset` aborts
-- at slice7a_accounts on an empty stack.
--
-- On the linked remote project this is a no-op because the user already
-- exists (verified at write time -- ON CONFLICT (id) DO NOTHING covers any
-- variance). The migration is idempotent and safe to apply anywhere.
--
-- This is NOT a production-shaped user-creation flow. The encrypted_password
-- is a stub; you cannot log in as this user. The row exists only so FKs
-- resolve. Real user provisioning happens through the Supabase Auth API.

BEGIN;

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
VALUES (
  'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'alex@alexhollienco.com',
  '$2a$10$LocalBootstrapStubNotUsableForLoginXXXXXXXXXXXXXXXXXXXX',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  false,
  false
)
ON CONFLICT (id) DO NOTHING;

-- Mirror entry into auth.identities so downstream auth helpers that expect
-- an identity row do not blow up. Idempotent.
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid,
  jsonb_build_object('sub', 'b735d691-4d86-4e31-9fd3-c2257822dca3', 'email', 'alex@alexhollienco.com'),
  'email',
  'b735d691-4d86-4e31-9fd3-c2257822dca3',
  now(),
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities
  WHERE user_id = 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
    AND provider = 'email'
);

COMMIT;
