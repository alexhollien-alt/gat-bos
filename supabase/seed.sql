-- Seed data for Relationship CRM
--
-- The seed_data(p_user_id uuid) function lives in
-- supabase/migrations/20260430999700_slice7a5_full_prod_mirror.sql (Slice 7A.5)
-- as part of versioned schema history. It is no longer (re)defined here.
--
-- After signing up, run:  select seed_data('your-user-id-here');

-- ============================================================================
-- Open House Blast: local test recipients (LOCAL ONLY, never runs on prod push)
-- Inserted under the first available account so FKs always resolve.
-- city '__mailtest__' routes controlled test inboxes through the real city match.
-- Real city pools (Scottsdale / Paradise Valley / Phoenix) prove segmentation.
-- These are placeholders for the real city-tagged import (flagged step in goal).
-- ============================================================================
DO $$
DECLARE
  v_account uuid;
  v_user    uuid;
BEGIN
  SELECT account_id, user_id INTO v_account, v_user
    FROM public.contacts
   WHERE account_id IS NOT NULL AND deleted_at IS NULL
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_account IS NULL THEN
    RAISE NOTICE 'open-house seed skipped: no account found';
    RETURN;
  END IF;

  INSERT INTO public.contacts
    (first_name, last_name, email, type, brokerage, city, tags, source, email_status, user_id, account_id)
  SELECT t.first_name, t.last_name, t.email, t.type, t.brokerage, t.city,
         t.tags, t.source, t.email_status, v_user, v_account
  FROM (VALUES
    -- __mailtest__ : controlled inboxes for the gated test send
    ('Alex','Gmail Seed',     'yourcoll2347@gmail.com', 'realtor','Seed','__mailtest__', ARRAY['open-house-pool','seed'],'open-house-seed','active'),
    ('Alex','AZGAT Seed',     'ahollien@azgat.com',     'realtor','Seed','__mailtest__', ARRAY['open-house-pool','seed'],'open-house-seed','active'),
    -- [PLACEHOLDER: replace with real Outlook test inbox]
    ('Test','Outlook Seed',   'placeholder-outlook@example.com', 'realtor','Seed','__mailtest__', ARRAY['open-house-pool','seed','placeholder'],'open-house-seed','active'),
    -- [PLACEHOLDER: replace with real Yahoo test inbox]
    ('Test','Yahoo Seed',     'placeholder-yahoo@example.com',   'realtor','Seed','__mailtest__', ARRAY['open-house-pool','seed','placeholder'],'open-house-seed','active'),

    -- Scottsdale pool (6) : example.com so accidental sends bounce harmlessly in dev
    ('Maria','Delgado',   'maria.delgado@example.com',   'realtor','RETSY','Scottsdale', ARRAY['open-house-pool','seed'],'open-house-seed','active'),
    ('James','Whitlock',  'james.whitlock@example.com',  'realtor','Compass','Scottsdale', ARRAY['open-house-pool','seed'],'open-house-seed','active'),
    ('Priya','Nair',      'priya.nair@example.com',      'realtor','Russ Lyon','Scottsdale', ARRAY['open-house-pool','seed'],'open-house-seed','active'),
    ('Derek','Olsson',    'derek.olsson@example.com',    'realtor','My Home Group','Scottsdale', ARRAY['open-house-pool','seed'],'open-house-seed','active'),
    ('Sandra','Kim',      'sandra.kim@example.com',      'realtor','eXp','Scottsdale', ARRAY['open-house-pool','seed'],'open-house-seed','active'),
    ('Tomas','Reyes',     'tomas.reyes@example.com',     'realtor','West USA','Scottsdale', ARRAY['open-house-pool','seed'],'open-house-seed','active'),

    -- Paradise Valley pool (3)
    ('Helen','Vasquez',   'helen.vasquez@example.com',   'realtor','Launch','Paradise Valley', ARRAY['open-house-pool','seed'],'open-house-seed','active'),
    ('Greg','Fontaine',   'greg.fontaine@example.com',   'realtor','Compass','Paradise Valley', ARRAY['open-house-pool','seed'],'open-house-seed','active'),
    ('Nadia','Bauer',     'nadia.bauer@example.com',     'realtor','RETSY','Paradise Valley', ARRAY['open-house-pool','seed'],'open-house-seed','active'),

    -- Phoenix pool (4)
    ('Carl','Mendez',     'carl.mendez@example.com',     'realtor','HomeSmart','Phoenix', ARRAY['open-house-pool','seed'],'open-house-seed','active'),
    ('Aisha','Roy',       'aisha.roy@example.com',       'realtor','Realty ONE','Phoenix', ARRAY['open-house-pool','seed'],'open-house-seed','active'),
    ('Owen','Pratt',      'owen.pratt@example.com',      'realtor','eXp','Phoenix', ARRAY['open-house-pool','seed'],'open-house-seed','active'),
    ('Lena','Cho',        'lena.cho@example.com',        'realtor','Keller Williams','Phoenix', ARRAY['open-house-pool','seed'],'open-house-seed','active')
  ) AS t(first_name, last_name, email, type, brokerage, city, tags, source, email_status)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.contacts c
     WHERE lower(c.email) = lower(t.email) AND c.deleted_at IS NULL
  );

  RAISE NOTICE 'open-house seed: test recipients ensured under account %', v_account;
END $$;

-- Remaining placeholders (Rule 1):
--   [PLACEHOLDER: real Outlook test inbox] -- replace placeholder-outlook@example.com
--   [PLACEHOLDER: real Yahoo test inbox]   -- replace placeholder-yahoo@example.com
-- The mail-tester.com address is dynamic per run and is supplied at test-send time,
-- not seeded here.
