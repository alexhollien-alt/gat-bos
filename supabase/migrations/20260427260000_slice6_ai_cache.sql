-- ============================================================
-- SLICE 6 TASK 2 -- ai_cache (per-feature durable result cache)
-- ============================================================
-- Plan:   Slice 6 (AI Layer Consolidation + Budget Guard)
-- Branch: gsd/012-slice-6-ai-consolidation-budget-guard
--
-- How to run:
--   Open Supabase SQL Editor. Paste this file. Run. Expect "COMMIT".
--   After paste, MCP autonomously runs NOTIFY pgrst, 'reload schema'.
--
-- Distinct from Anthropic's prompt cache (5-min server-side TTL,
-- automatic). ai_cache is a per-feature durable result cache
-- across runs (e.g. morning-brief computed today's prompt cache
-- hash, don't re-hit Anthropic if the same input fires within
-- the day). Helper at src/lib/ai/_cache.ts.
--
-- Soft delete (standing rule 3): deleted_at column. No hard deletes.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- ai_cache: durable result cache, keyed (feature, cache_key)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_cache (
  feature      text NOT NULL,
  cache_key    text NOT NULL,
  value        jsonb NOT NULL,
  model        text,
  expires_at   timestamptz,
  accessed_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  PRIMARY KEY (feature, cache_key)
);

COMMENT ON TABLE public.ai_cache IS
  'Slice 6: per-feature durable result cache. expires_at NULL = TTL-less. cache_key is sha256 hex of normalized input (helper: src/lib/ai/_cache.ts cacheKey()).';
COMMENT ON COLUMN public.ai_cache.value IS
  'Cached response payload. Shape determined by the capability writing it.';
COMMENT ON COLUMN public.ai_cache.expires_at IS
  'When NULL, the entry has no TTL and persists until soft-deleted. When set, _cache.cacheGet() returns null if now() > expires_at.';

-- ------------------------------------------------------------
-- Index for cleanup (find expired live rows)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ai_cache_feature_expires_at
  ON public.ai_cache (feature, expires_at)
  WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- RLS: Alex-only
-- ------------------------------------------------------------
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_ai_cache_all ON public.ai_cache;
CREATE POLICY alex_ai_cache_all ON public.ai_cache
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com');

COMMIT;

-- ============================================================
-- Verify (optional sanity checks):
--
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'ai_cache';
--   -- expect: ai_cache, t
--
--   SELECT indexname FROM pg_indexes WHERE tablename = 'ai_cache' ORDER BY indexname;
--   -- expect: ai_cache_pkey, idx_ai_cache_feature_expires_at
--
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.ai_cache'::regclass;
--   -- expect: alex_ai_cache_all
-- ============================================================
