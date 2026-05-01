-- Slice 7B Task 3 -- Seed 5 agent contact rows (PATH A: upsert-by-email)
--
-- Promotes the canonical agent roster to type='agent' with slug + tagline +
-- headshot_url: Julie Jarmiolowski, Fiona Bigbee, Denise van den Bossche,
-- Joey Gutierrez, Amber Hollien.
--
-- COLLISION CONTEXT
-- -----------------
-- The baseline (~/crm/supabase/migrations/20260407012800_baseline.sql:892)
-- enforces a global UNIQUE constraint `contacts_email_unique UNIQUE (email)`.
-- Four of the five seed targets are pre-existing prod contacts (type='realtor'
-- and similar) tied to live deals, opportunities, and interactions by FK.
-- A naive INSERT would collide on email before the slug ON CONFLICT could
-- fire, and a hard-replace would drop FK history.
--
-- PATH A RESOLUTION
-- -----------------
-- Use `ON CONFLICT (email) DO UPDATE` so existing rows are promoted in place.
-- We overwrite only the agent-classification fields (type, slug, tagline,
-- headshot_url, brokerage, title) plus first_name/last_name (canonical here).
-- We do NOT overwrite `source` (preserve provenance) and we do NOT clobber an
-- existing phone with a NULL from the seed.
--
-- Per plan (~/.claude/plans/2026-04-30-slice-7b-locked.md):
--   - type = 'agent' (added to contacts_type_check in Task 1)
--   - headshot_url populated (NOT photo_url; see Q-drift-2)
--   - account_id resolved from accounts.owner_user_id (single-tenant pre-7C)
--   - Julie/Fiona/Denise taglines from approved 2026-04-21 drafts
--   - Joey + Amber tagline NULL per Q3 answer (c) -- route hides null tagline
--   - Joey slug = 'joey-gutierrez' per permanent naming rule (LATER.md)
--
-- Idempotency: ON CONFLICT (email) matches the global constraint exactly.
-- Re-running this migration is a no-op on field values that already match.
--
-- Backfill row-count assertion per LATER.md [2026-04-26] practice rule.

BEGIN;

DO $$
DECLARE
  v_user_id    uuid;
  v_account_id uuid;
  v_total      integer;
BEGIN
  -- 1. Resolve seed-target account + owner_user_id.
  --    Pre-7C is single-tenant: exactly one active account exists.
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

  -- 2. Upsert the 5 agent rows by email.
  --    DO UPDATE preserves source + created_at + user_id and only clobbers
  --    fields where the seed is canonical truth.
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
  ON CONFLICT (email) DO UPDATE SET
    first_name   = EXCLUDED.first_name,
    last_name    = EXCLUDED.last_name,
    phone        = COALESCE(public.contacts.phone, EXCLUDED.phone),
    type         = EXCLUDED.type,
    brokerage    = EXCLUDED.brokerage,
    title        = EXCLUDED.title,
    headshot_url = EXCLUDED.headshot_url,
    website_url  = COALESCE(EXCLUDED.website_url, public.contacts.website_url),
    slug         = EXCLUDED.slug,
    tagline      = EXCLUDED.tagline,
    account_id   = EXCLUDED.account_id,
    deleted_at   = NULL,
    updated_at   = now();

  -- 3. Row-count assertion: post-condition is exactly 5 active 'agent' rows
  --    with these slugs for this account (idempotent on re-run).
  SELECT count(*) INTO v_total
  FROM public.contacts
  WHERE account_id = v_account_id
    AND type = 'agent'
    AND deleted_at IS NULL
    AND slug IN (
      'julie-jarmiolowski',
      'fiona-bigbee',
      'denise-van-den-bossche',
      'joey-gutierrez',
      'amber-hollien'
    );

  RAISE NOTICE
    'Slice 7B Task 3 seed (Path A): % active agent rows for account % matching seed slugs.',
    v_total, v_account_id;

  IF v_total <> 5 THEN
    RAISE EXCEPTION
      'Slice 7B Task 3: expected 5 active agent rows for account %, got %.',
      v_account_id, v_total;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- Verification (run after the COMMIT)
-- ============================================================================
-- 3a. Row presence + correctness:
--   SELECT slug, first_name, last_name, type, source, brokerage,
--          (tagline IS NOT NULL) AS has_tagline
--     FROM public.contacts
--    WHERE slug IN ('julie-jarmiolowski','fiona-bigbee','denise-van-den-bossche',
--                   'joey-gutierrez','amber-hollien')
--      AND deleted_at IS NULL
--    ORDER BY slug;
--   EXPECTED: 5 rows; type='agent'; has_tagline = t for julie/fiona/denise,
--             f for joey/amber. Source may vary (preserved from prior rows).
--
-- 3b. Confirm headshot_url populated:
--   SELECT slug, headshot_url FROM public.contacts
--    WHERE slug IN ('julie-jarmiolowski','fiona-bigbee','denise-van-den-bossche',
--                   'joey-gutierrez','amber-hollien')
--    ORDER BY slug;
--   EXPECTED: 5 rows, each headshot_url = '/agents/<slug>.jpg'.
--
-- 3c. Confirm account_id is single-tenant (Alex's account):
--   SELECT count(DISTINCT account_id) FROM public.contacts
--    WHERE slug IN ('julie-jarmiolowski','fiona-bigbee','denise-van-den-bossche',
--                   'joey-gutierrez','amber-hollien');
--   EXPECTED: 1.
--
-- ============================================================================
-- Rollback (manual; soft-delete only per Standing Rule 3)
-- ============================================================================
-- Path A note: rollback finds rows by slug, NOT by source, since this seed
-- preserves whatever source value existed before promotion.
--
--   BEGIN;
--   UPDATE public.contacts
--      SET deleted_at = now(),
--          updated_at = now()
--    WHERE slug IN (
--            'julie-jarmiolowski',
--            'fiona-bigbee',
--            'denise-van-den-bossche',
--            'joey-gutierrez',
--            'amber-hollien'
--          )
--      AND deleted_at IS NULL;
--   COMMIT;
--
-- The partial unique index contacts_account_slug_unique filters
-- WHERE deleted_at IS NULL, so rolled-back slugs free up for re-seed.
