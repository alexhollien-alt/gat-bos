-- Slice 3A Task 3a -- operational rate_limits table.
--
-- Time-bounded counter store for the Supabase-backed rate limiter at
-- src/lib/rate-limit/check.ts. Rows hold a per-key, per-window counter
-- that the helper increments via INSERT ... ON CONFLICT atomic upsert.
--
-- Standing Rule 3 carve-out: rate-limit rows are operational data, not
-- user-observable records. Hard-delete is permitted (and required) so
-- the helper can opportunistically cull rows older than 2x the longest
-- window on each call. Soft-delete with deleted_at would defeat the
-- purpose and let counters grow unbounded.
--
-- RLS is enabled with deny-all policies for anon and authenticated.
-- Service role bypasses RLS, so the rate limiter (which runs server-side
-- with the service-role key) reads and writes freely. No client should
-- ever touch this table directly.

DROP TABLE IF EXISTS public.rate_limits;

CREATE TABLE public.rate_limits (
  key          text         NOT NULL,
  count        int          NOT NULL DEFAULT 0,
  window_start timestamptz  NOT NULL,
  PRIMARY KEY (key, window_start)
);

-- Cleanup scans target old window_start values; index supports the
-- opportunistic DELETE ... WHERE window_start < now() - interval pattern.
CREATE INDEX rate_limits_window_start_idx
  ON public.rate_limits (window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Deny-all policies for non-service-role traffic. Service role bypasses
-- RLS entirely, so omitting policies for service role is correct.
CREATE POLICY rate_limits_deny_anon
  ON public.rate_limits
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY rate_limits_deny_authenticated
  ON public.rate_limits
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.rate_limits IS
  'Operational counter store for the Supabase-backed sliding-window rate limiter. Service-role only. Rows are time-bounded; helper culls expired windows opportunistically.';
