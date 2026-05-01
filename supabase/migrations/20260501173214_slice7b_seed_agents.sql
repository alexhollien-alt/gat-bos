-- Slice 7B Task 3 -- Seed 5 agent contact rows
--
-- Inserts the canonical agent roster: Julie Jarmiolowski, Fiona Bigbee,
-- Denise van den Bossche, Joey Gutierrez, Amber Hollien.
--
-- Per plan (~/.claude/plans/2026-04-30-slice-7b-locked.md):
--   - type = 'agent' (added to contacts_type_check in Task 1)
--   - headshot_url populated (NOT photo_url; see Q-drift-2)
--   - account_id resolved from accounts.owner_user_id = Alex's auth.users.id
--   - source = 'manual_seed' (rollback marker per Rule 3 soft-delete)
--   - Julie/Fiona/Denise taglines from approved 2026-04-21 drafts (also live
--     in src/app/agents/[slug]/page.tsx until Task 4 cuts the const over)
--   - Joey + Amber tagline NULL per Q3 answer (c) -- route hides null tagline
--   - Joey slug = 'joey-gutierrez' per permanent naming rule (LATER.md)
--
-- Idempotency: ON CONFLICT (account_id, slug) WHERE deleted_at IS NULL AND
-- slug IS NOT NULL DO UPDATE -- predicate matches Task 1's partial unique index
-- contacts_account_id_slug_uniq exactly.
--
-- Backfill row-count assertion per LATER.md [2026-04-26] practice rule.

BEGIN;

DO $$
DECLARE
  v_user_id    uuid;
  v_account_id uuid;
  v_inserted   integer;
  v_total      integer;
BEGIN
  -- 1. Resolve seed-target account + owner_user_id.
  --    Pre-7C is single-tenant: exactly one active account exists.
  --    Matches Task 1 + Tasks 2a-2f (no hardcoded email; join via
  --    accounts.owner_user_id is the canonical link).
  SELECT id, owner_user_id INTO v_account_id, v_user_id
  FROM public.accounts
  WHERE deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION
      'Slice 7B Task 3: no active account found in public.accounts; Slice 7A precondition unmet.';
  END IF;

  IF (SELECT count(*) FROM public.accounts WHERE deleted_at IS NULL) > 1 THEN
    RAISE EXCEPTION
      'Slice 7B Task 3: multiple active accounts found; pre-7C single-tenant assumption violated. Re-scope this seed before re-running.';
  END IF;

  -- 2. Insert (or upsert) the 5 agent rows.
  INSERT INTO public.contacts (
    first_name,
    last_name,
    email,
    phone,
    type,
    brokerage,
    title,
    headshot_url,
    website_url,
    slug,
    tagline,
    account_id,
    user_id,
    source
  )
  VALUES
    (
      'Julie', 'Jarmiolowski',
      'julie@kay-grant.com',
      '+16026635256',
      'agent',
      'My Home Group -- Kay-Grant Group',
      'Real Estate Advisor',
      '/agents/julie-jarmiolowski.jpg',
      'https://www.kay-grant.com/julie',
      'julie-jarmiolowski',
      'Optima Camelview resident and realtor, guiding neighbors through one of the Valley''s most architectural addresses.',
      v_account_id, v_user_id, 'manual_seed'
    ),
    (
      'Fiona', 'Bigbee',
      'fiona.bigbee@gmail.com',
      NULL,
      'agent',
      'Coldwell Banker Realty',
      'Real Estate Agent',
      '/agents/fiona-bigbee.jpg',
      NULL,
      'fiona-bigbee',
      '85258 is my backyard. Your next move starts with the agent who knows every block.',
      v_account_id, v_user_id, 'manual_seed'
    ),
    (
      'Denise', 'van den Bossche',
      'denisevdb@exec-elite.com',
      NULL,
      'agent',
      'Realty Executives Arizona Territory -- Exec-Elite',
      'Real Estate Advisor',
      '/agents/denise-van-den-bossche.jpg',
      NULL,
      'denise-van-den-bossche',
      'Paradise Valley and Scottsdale, handled quietly. Discretion is the service.',
      v_account_id, v_user_id, 'manual_seed'
    ),
    (
      'Joey', 'Gutierrez',
      'Homeprosreco@gmail.com',
      NULL,
      'agent',
      'Barrett Real Estate',
      NULL,
      '/agents/joey-gutierrez.jpg',
      NULL,
      'joey-gutierrez',
      NULL,
      v_account_id, v_user_id, 'manual_seed'
    ),
    (
      'Amber', 'Hollien',
      'amber@amberhollien.com',
      NULL,
      'agent',
      'My Home Group',
      NULL,
      '/agents/amber-hollien.jpg',
      NULL,
      'amber-hollien',
      NULL,
      v_account_id, v_user_id, 'manual_seed'
    )
  ON CONFLICT (account_id, slug) WHERE deleted_at IS NULL AND slug IS NOT NULL
  DO UPDATE SET
    first_name   = EXCLUDED.first_name,
    last_name    = EXCLUDED.last_name,
    email        = EXCLUDED.email,
    phone        = EXCLUDED.phone,
    type         = EXCLUDED.type,
    brokerage    = EXCLUDED.brokerage,
    title        = EXCLUDED.title,
    headshot_url = EXCLUDED.headshot_url,
    website_url  = EXCLUDED.website_url,
    tagline      = EXCLUDED.tagline,
    source       = EXCLUDED.source,
    updated_at   = now();

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- 3. Row-count assertion: post-condition is exactly 5 active 'agent' rows
  --    for this account (idempotent on re-run).
  SELECT count(*) INTO v_total
  FROM public.contacts
  WHERE account_id = v_account_id
    AND type = 'agent'
    AND deleted_at IS NULL
    AND source = 'manual_seed'
    AND slug IN (
      'julie-jarmiolowski',
      'fiona-bigbee',
      'denise-van-den-bossche',
      'joey-gutierrez',
      'amber-hollien'
    );

  RAISE NOTICE
    'Slice 7B Task 3 seed: % rows inserted/updated this run; % total active agent rows for account.',
    v_inserted, v_total;

  IF v_total <> 5 THEN
    RAISE EXCEPTION
      'Slice 7B Task 3: expected 5 active seeded agent rows for account %, got %.',
      v_account_id, v_total;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- Verification (run after the COMMIT; eyeball expected results)
-- ============================================================================
-- 3a. Row presence + correctness:
--   SELECT slug, first_name, last_name, type, source, brokerage,
--          (tagline IS NOT NULL) AS has_tagline
--     FROM public.contacts
--    WHERE source = 'manual_seed'
--      AND type = 'agent'
--      AND deleted_at IS NULL
--    ORDER BY slug;
--   EXPECTED: 5 rows; has_tagline = t for julie/fiona/denise, f for joey/amber.
--
-- 3b. Confirm headshot_url populated, photo_url not used:
--   SELECT slug, headshot_url FROM public.contacts WHERE source='manual_seed' ORDER BY slug;
--   EXPECTED: 5 rows, each headshot_url = '/agents/<slug>.jpg'.
--
-- 3c. Confirm account_id is single-tenant (Alex's account):
--   SELECT count(DISTINCT account_id) FROM public.contacts WHERE source='manual_seed';
--   EXPECTED: 1.
--
-- 3d. Confirm idempotency (re-run via supabase db reset -> still 5 active rows).
--
-- ============================================================================
-- Rollback (manual; soft-delete only per Standing Rule 3)
-- ============================================================================
-- Run as a separate transaction if the seed needs to be reversed:
--
--   BEGIN;
--   UPDATE public.contacts
--      SET deleted_at = now(),
--          updated_at = now()
--    WHERE source = 'manual_seed'
--      AND type = 'agent'
--      AND deleted_at IS NULL
--      AND slug IN (
--        'julie-jarmiolowski',
--        'fiona-bigbee',
--        'denise-van-den-bossche',
--        'joey-gutierrez',
--        'amber-hollien'
--      );
--   COMMIT;
--
-- The partial unique index contacts_account_id_slug_uniq filters
-- WHERE deleted_at IS NULL, so rolled-back slugs free up for re-seed.
