-- 7A.5 fix: seed Alex's auth.users row for fresh local replay.
--
-- Many subsequent migrations hardcode Alex's UUID
-- (b735d691-4d86-4e31-9fd3-c2257822dca3) in INSERTs that have FK constraints
-- to auth.users, or in idempotent backfills guarded by "if Alex exists then
-- update" patterns. On a fresh local Docker DB, auth.users is empty, so those
-- migrations either FK-fail or no-op. This seed inserts a minimum-viable row
-- so replay reaches end-of-history. Idempotent via ON CONFLICT (id) DO NOTHING
-- so prod (where Alex already exists with real auth metadata) is unaffected.
-- This file will be repaired-as-applied against prod via
-- `supabase migration repair --status applied` per the 7A.5 reconciliation plan.

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_super_admin,
  is_anonymous
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'b735d691-4d86-4e31-9fd3-c2257822dca3',
  'authenticated',
  'authenticated',
  'alex+local@example.com',
  crypt('localseed', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  false,
  false
) ON CONFLICT (id) DO NOTHING;
