-- ============================================================
-- Slice 7A.5 -- Reconstructed prod mirror
-- Source: production schema_migrations row at version 20260427203006
-- Reconstructed: 2026-04-30
-- This file is byte-equivalent (or semantically equivalent) to the
-- DDL applied to production at 20260427203006. Reconstructed as part of
-- migration history reconciliation because the original local file
-- was missing.
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_ai_cache_feature_expires_at
  ON public.ai_cache (feature, expires_at)
  WHERE deleted_at IS NULL;

ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_ai_cache_all ON public.ai_cache;
CREATE POLICY alex_ai_cache_all ON public.ai_cache
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com');
