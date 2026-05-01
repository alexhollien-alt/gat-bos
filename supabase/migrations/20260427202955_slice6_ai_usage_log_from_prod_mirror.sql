-- ============================================================
-- Slice 7A.5 -- Reconstructed prod mirror
-- Source: production schema_migrations row at version 20260427202955
-- Reconstructed: 2026-04-30
-- This file is byte-equivalent (or semantically equivalent) to the
-- DDL applied to production at 20260427202955. Reconstructed as part of
-- migration history reconciliation because the original local file
-- was missing.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature                 text NOT NULL,
  model                   text NOT NULL,
  input_tokens            integer NOT NULL DEFAULT 0,
  output_tokens           integer NOT NULL DEFAULT 0,
  cache_read_tokens       integer NOT NULL DEFAULT 0,
  cache_creation_tokens   integer NOT NULL DEFAULT 0,
  cost_usd                numeric(10,6) NOT NULL DEFAULT 0,
  occurred_at             timestamptz NOT NULL DEFAULT now(),
  context                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id                 uuid NOT NULL,
  deleted_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_usage_log IS
  'Slice 6: per-call audit + cost tracking for Claude API. Feature column is enum-style text for forward-compat (morning-brief, capture-parse, draft-generate, inbox-score, etc.).';
COMMENT ON COLUMN public.ai_usage_log.cost_usd IS
  'Computed at write time from src/lib/ai/_pricing.ts rate table. numeric(10,6) supports up to 9999.999999.';
COMMENT ON COLUMN public.ai_usage_log.context IS
  'Free-form jsonb for capability-specific metadata (cache_hit boolean, prompt_version, error info on failure rows, etc.).';

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_occurred_at
  ON public.ai_usage_log (occurred_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature_occurred_at
  ON public.ai_usage_log (feature, occurred_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_ai_usage_log_all ON public.ai_usage_log;
CREATE POLICY alex_ai_usage_log_all ON public.ai_usage_log
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com');

CREATE OR REPLACE FUNCTION public.current_day_ai_spend_usd()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $func$
  SELECT COALESCE(SUM(cost_usd), 0)::numeric
  FROM public.ai_usage_log
  WHERE deleted_at IS NULL
    AND occurred_at >= date_trunc('day', now() AT TIME ZONE 'America/Phoenix') AT TIME ZONE 'America/Phoenix';
$func$;

COMMENT ON FUNCTION public.current_day_ai_spend_usd() IS
  'Slice 6: returns running USD spend for today (America/Phoenix calendar day). Used by src/lib/ai/_budget.ts to enforce AI_DAILY_BUDGET_USD.';

REVOKE ALL ON FUNCTION public.current_day_ai_spend_usd() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_day_ai_spend_usd() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_day_ai_spend_usd() TO service_role;
