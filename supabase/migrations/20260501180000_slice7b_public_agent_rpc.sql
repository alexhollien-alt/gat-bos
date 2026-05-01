-- Slice 7B Task 5 -- Public agent read via security-definer RPC
--
-- Per plan (~/.claude/plans/2026-04-30-slice-7b-locked.md), Q2 = (b):
-- security-definer RPC is the anon-read mechanism for /agents/[slug].
-- Replaces the starter's "anon SELECT carve-out + column whitelist at route
-- layer" approach with two RPCs that whitelist columns at the database layer.
--
-- Why RPC over RLS carve-out:
--   - Column whitelist is enforced at the DB, not at the route. Defense in
--     depth: a future route bug cannot leak account_id, user_id, internal_note,
--     or other private columns.
--   - Anon clients call only `rpc('get_public_agent_by_slug', ...)` and
--     `rpc('get_public_agent_slugs')`. They cannot SELECT * FROM contacts.
--   - No anon-facing RLS policy added on `contacts`. The table stays fully
--     locked to authenticated + account-scoped (per Task 1).
--
-- Two RPCs:
--   1. get_public_agent_slugs()         -- enumerate slugs for SSG
--   2. get_public_agent_by_slug(p_slug) -- fetch one agent by slug
--
-- Both SECURITY DEFINER, owned by postgres, search_path = public.
-- GRANT EXECUTE TO anon, authenticated.

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. List all public agent slugs (used by Next.js generateStaticParams)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_agent_slugs()
RETURNS TABLE (slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.slug
    FROM public.contacts c
   WHERE c.type = 'agent'
     AND c.deleted_at IS NULL
     AND c.slug IS NOT NULL
   ORDER BY c.slug;
$$;

REVOKE ALL ON FUNCTION public.get_public_agent_slugs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_agent_slugs() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Fetch one public agent by slug (used by route + metadata)
-- ----------------------------------------------------------------------------
-- Whitelisted columns: id, slug, first_name, last_name, title, brokerage,
-- headshot_url, tagline, phone, email, website_url.
--
-- Excluded (NOT exposed to anon): account_id, user_id, deleted_at, source,
-- created_at, updated_at, internal_note, notes, stage, tier, rep_pulse,
-- health_score, farm_area, farm_zips, brand_colors, palette, font_kit,
-- license_number, instagram_handle, linkedin_url, escrow_officer,
-- contact_md_path, brokerage_logo_url, agent_logo_url, last_touchpoint,
-- next_action, next_followup, preferred_channel, referred_by, type.
--
-- Email + phone are intentionally public: an agent landing page exists to
-- give prospective clients direct contact paths to the agent.
CREATE OR REPLACE FUNCTION public.get_public_agent_by_slug(p_slug text)
RETURNS TABLE (
  id           uuid,
  slug         text,
  first_name   text,
  last_name    text,
  title        text,
  brokerage    text,
  headshot_url text,
  tagline      text,
  phone        text,
  email        text,
  website_url  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.slug,
    c.first_name,
    c.last_name,
    c.title,
    c.brokerage,
    c.headshot_url,
    c.tagline,
    c.phone,
    c.email,
    c.website_url
  FROM public.contacts c
  WHERE c.type = 'agent'
    AND c.deleted_at IS NULL
    AND c.slug = p_slug
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_agent_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_agent_by_slug(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- Verification (run after the COMMIT)
-- ============================================================================
-- 5a. Confirm both functions exist and are SECURITY DEFINER:
--   SELECT proname, prosecdef
--     FROM pg_proc
--    WHERE pronamespace = 'public'::regnamespace
--      AND proname IN ('get_public_agent_slugs', 'get_public_agent_by_slug');
--   EXPECTED: 2 rows, prosecdef = t for both.
--
-- 5b. Confirm anon has EXECUTE:
--   SELECT routine_name, grantee, privilege_type
--     FROM information_schema.routine_privileges
--    WHERE routine_schema = 'public'
--      AND routine_name IN ('get_public_agent_slugs', 'get_public_agent_by_slug')
--      AND grantee IN ('anon', 'authenticated')
--    ORDER BY routine_name, grantee;
--   EXPECTED: 4 rows (2 functions x 2 roles), all EXECUTE.
--
-- 5c. Slug list returns the 5 seeded agents:
--   SELECT * FROM public.get_public_agent_slugs();
--   EXPECTED: amber-hollien, denise-van-den-bossche, fiona-bigbee,
--             joey-gutierrez, julie-jarmiolowski.
--
-- 5d. Slug lookup whitelists columns:
--   SELECT * FROM public.get_public_agent_by_slug('julie-jarmiolowski');
--   EXPECTED: 1 row, 11 columns. No account_id, user_id, source columns.
--
-- 5e. Anon-role smoke (authoritative defense check):
--   SET ROLE anon;
--     SELECT count(*) FROM public.get_public_agent_slugs();      -- 5
--     SELECT first_name FROM public.get_public_agent_by_slug('julie-jarmiolowski'); -- 'Julie'
--     SELECT count(*) FROM public.contacts;                       -- 0 (RLS denies)
--   RESET ROLE;
--   EXPECTED: RPC succeeds for anon; direct table read returns 0 rows.
