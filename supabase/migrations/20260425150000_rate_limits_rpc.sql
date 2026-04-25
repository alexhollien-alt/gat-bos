-- Slice 3A Task 3c -- atomic increment RPC for the rate limiter.
--
-- The plan calls for true Postgres-atomic increment via
--   INSERT ... ON CONFLICT (key, window_start)
--     DO UPDATE SET count = rate_limits.count + 1
--     RETURNING count
--
-- PostgREST's .upsert() cannot express "count = count + 1" in the conflict
-- clause, so the helper at src/lib/rate-limit/check.ts calls this function
-- via supabase.rpc('increment_rate_limit', ...). The function is the only
-- write path the helper uses.
--
-- SECURITY DEFINER so the function runs with table-owner privileges and
-- bypasses RLS regardless of how it's invoked. The helper still hits this
-- endpoint with the service-role key, but DEFINER hardens against future
-- callers being added with weaker grants.

CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_key          text,
  p_window_start timestamptz
)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (p_key, p_window_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count;
$$;

REVOKE ALL ON FUNCTION public.increment_rate_limit(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_rate_limit(text, timestamptz) TO service_role;

COMMENT ON FUNCTION public.increment_rate_limit(text, timestamptz) IS
  'Atomic upsert+increment for the Supabase-backed sliding-window rate limiter. Returns the post-increment count for (key, window_start). Service-role only.';
