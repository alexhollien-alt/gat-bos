-- ============================================================
-- SLICE 6 TASK 1 -- ai_usage_log + current_day_ai_spend_usd RPC
-- ============================================================
-- Plan:   Slice 6 (AI Layer Consolidation + Budget Guard)
-- Branch: gsd/012-slice-6-ai-consolidation-budget-guard
--
-- How to run:
--   Open Supabase SQL Editor. Paste this file. Run. Expect "COMMIT".
--   After paste, MCP autonomously runs NOTIFY pgrst, 'reload schema'.
--
-- Idempotent. Safe to re-run. CREATE TABLE IF NOT EXISTS + DROP POLICY
-- IF EXISTS pattern matches Slice 4-5B precedent.
--
-- Soft delete (standing rule 3): deleted_at column. No hard deletes.
-- RLS: Alex-only via auth.jwt() ->> 'email' = 'alex@alexhollienco.com'.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- ai_usage_log: per-call audit row for every Claude API call
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_occurred_at
  ON public.ai_usage_log (occurred_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature_occurred_at
  ON public.ai_usage_log (feature, occurred_at DESC)
  WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- RLS: Alex-only
-- ------------------------------------------------------------
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_ai_usage_log_all ON public.ai_usage_log;
CREATE POLICY alex_ai_usage_log_all ON public.ai_usage_log
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com');

-- ------------------------------------------------------------
-- RPC: current_day_ai_spend_usd
--
-- Returns running USD spend for today in America/Phoenix tz.
-- SECURITY DEFINER so the budget guard can read aggregate spend
-- without granting per-row SELECT. The function exposes a single
-- scalar; callers cannot use it to enumerate rows.
-- ------------------------------------------------------------
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

-- Tighten grants. Authenticated callers (Alex via the app) can call;
-- anon cannot.
REVOKE ALL ON FUNCTION public.current_day_ai_spend_usd() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_day_ai_spend_usd() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_day_ai_spend_usd() TO service_role;

COMMIT;

-- ============================================================
-- Verify (optional sanity checks):
--
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'ai_usage_log';
--   -- expect: ai_usage_log, t
--
--   SELECT indexname FROM pg_indexes WHERE tablename = 'ai_usage_log' ORDER BY indexname;
--   -- expect: ai_usage_log_pkey, idx_ai_usage_log_feature_occurred_at, idx_ai_usage_log_occurred_at
--
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.ai_usage_log'::regclass;
--   -- expect: alex_ai_usage_log_all
--
--   SELECT public.current_day_ai_spend_usd();
--   -- expect: 0 (or running total if rows already exist)
-- ============================================================
