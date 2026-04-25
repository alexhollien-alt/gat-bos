-- ================================================================
-- SLICE 3 / Wave 3: Backfill interactions_legacy rows into activity_events
-- Inserts each legacy interaction as an activity_events row with
-- verb='interaction.backfilled' and context.legacy_id for idempotency.
-- The interactions VIEW (rewritten in W4) reads context.type via
-- COALESCE to preserve the original interaction_type for these rows.
-- Slice 3 -- 2026-04-24.
-- ================================================================

BEGIN;

INSERT INTO public.activity_events
  (user_id, actor_id, verb, object_table, object_id, occurred_at, context)
SELECT
  il.user_id,
  il.user_id                                       AS actor_id,
  'interaction.backfilled'                         AS verb,
  'contacts'                                       AS object_table,
  il.contact_id                                    AS object_id,
  il.occurred_at,
  jsonb_build_object(
    'contact_id',       il.contact_id,
    'summary',          il.summary,
    'type',             il.type::text,
    'direction',        il.direction,
    'duration_minutes', il.duration_minutes,
    'legacy_id',        il.id,
    'source',           'legacy_backfill'
  )                                                AS context
FROM public.interactions_legacy il
WHERE NOT EXISTS (
  SELECT 1
  FROM public.activity_events ae
  WHERE ae.context->>'legacy_id' = il.id::text
);

COMMIT;
