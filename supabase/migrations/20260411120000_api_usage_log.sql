-- 2026-04-11: API Usage Log table for Adviser Strategy cost tracking
-- Idempotent: safe to replay. IF NOT EXISTS on all DDL.
-- Append-only log -- no updated_at column.

BEGIN;

CREATE TABLE IF NOT EXISTS public.api_usage_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL DEFAULT auth.uid(),
  feature_key           text NOT NULL,
  executor_model        text NOT NULL,
  adviser_called        boolean NOT NULL DEFAULT false,
  adviser_call_count    integer NOT NULL DEFAULT 0,
  input_tokens          integer NOT NULL DEFAULT 0,
  output_tokens         integer NOT NULL DEFAULT 0,
  cost_estimate_cents   numeric(10,4) NOT NULL DEFAULT 0,
  duration_ms           integer,
  error                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

CREATE INDEX IF NOT EXISTS idx_api_usage_log_user_created
  ON public.api_usage_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_log_feature
  ON public.api_usage_log (feature_key, created_at DESC);

ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own api_usage_log" ON public.api_usage_log;
CREATE POLICY "Users manage own api_usage_log"
  ON public.api_usage_log
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;
