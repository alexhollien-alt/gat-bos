-- ============================================================
-- SLICE 7A TASK 0b-suppl-16 -- oauth_tokens.user_id text -> uuid type fix
-- ============================================================
-- Plan:    ~/.claude/plans/slice-7a-multi-tenant-auth-rls.md
-- Branch:  gsd/013-slice-7a-multi-tenant-auth-rls-rewrite
-- Phase:   0b structural amendment (post-lock, 2026-04-29), pre-B-12 retry
--
-- Discovered during B-12 execution: oauth_tokens.user_id type mismatch
-- (text vs uuid). Surfaced because pre-flight 3.d only checked column
-- presence, not type. CASE-mapped 'alex' literal to OWNER_USER_ID
-- (b735d691-4d86-4e31-9fd3-c2257822dca3); pre-check confirmed only
-- distinct user_id value is 'alex' (count=1). Lands as atomic
-- pre-B-12-retry commit, between B-11 (morning_briefs_rls) and
-- B-12 (oauth_tokens_rls) in chronology.
--
-- Filename uses the 20260427300200 RLS-batch slot with `oauth_tokens_0_`
-- prefix so it sorts after morning_briefs_rls (B-11) and before
-- oauth_tokens_rls (B-12) lexicographically.
--
-- Paired rollback: PASTE-INTO-SUPABASE-7a-0b-suppl-16-oauth_tokens-type-fix-rollback.sql
-- ============================================================

BEGIN;

-- Step 1: drop default 'alex'
ALTER TABLE public.oauth_tokens ALTER COLUMN user_id DROP DEFAULT;

-- Step 2: drop existing UNIQUE (user_id, provider) so type can change
ALTER TABLE public.oauth_tokens DROP CONSTRAINT IF EXISTS oauth_tokens_user_id_provider_key;

-- Step 3: convert text -> uuid, mapping 'alex' literal to OWNER_USER_ID
ALTER TABLE public.oauth_tokens
  ALTER COLUMN user_id TYPE uuid
  USING (
    CASE
      WHEN user_id = 'alex' THEN 'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid
      ELSE user_id::uuid
    END
  );

-- Step 4: set DEFAULT auth.uid() for future inserts under RLS
ALTER TABLE public.oauth_tokens ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Step 5: add FK to auth.users
ALTER TABLE public.oauth_tokens
  ADD CONSTRAINT oauth_tokens_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- Step 6: recreate UNIQUE on (user_id, provider) with new uuid type
ALTER TABLE public.oauth_tokens
  ADD CONSTRAINT oauth_tokens_user_id_provider_key UNIQUE (user_id, provider);

-- Step 7: add index on user_id
CREATE INDEX IF NOT EXISTS oauth_tokens_user_id_idx ON public.oauth_tokens (user_id);

COMMIT;

-- ============================================================
-- Verify (post-apply, MCP-confirmed 2026-04-29):
--   data_type=uuid, is_nullable=NO, default=auth.uid()
--   FK oauth_tokens_user_id_fkey -> auth.users(id) ON DELETE RESTRICT
--   UNIQUE oauth_tokens_user_id_provider_key on (user_id, provider)
--   INDEX oauth_tokens_user_id_idx on (user_id)
--   NULL count = 0; 1 row mapped 'alex' -> b735d691-4d86-4e31-9fd3-c2257822dca3
-- ============================================================
