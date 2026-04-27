-- 20260426120000_backfill_last_touchpoint_to_activity_events.sql
--
-- One-shot backfill: copy contacts.last_touchpoint into activity_events
-- so the drift query has source rows to read.
--
-- Background: Slice 3 W3 (20260425110000_slice3_legacy_backfill.sql) ran
-- against an interactions_legacy table that held =<4 rows at execution
-- time, and W4 (20260425120000_slice3_view_rewrite_drop_legacy.sql)
-- dropped the table. The 78 A/B/C contacts whose history lived only in
-- the denormalized contacts.last_touchpoint field were never copied
-- into the activity ledger, so the 2026-04-25 morning brief saw
-- effective_drift=1000 for all 103 contacts.
--
-- Source: contacts.last_touchpoint (untouched after this runs -- one-way copy).
-- Target: public.activity_events, verb='interaction.backfilled',
--         object_table='contacts', object_id=contact_id.
-- Idempotent: NOT EXISTS guard on context.source + context.contact_id.
-- Safety:    fails loudly if source row count has drifted from 78
--            (the count confirmed against live db at draft time).

BEGIN;

WITH inserted AS (
  INSERT INTO public.activity_events (
    user_id,
    actor_id,
    verb,
    object_table,
    object_id,
    context,
    occurred_at
  )
  SELECT
    c.user_id,
    c.user_id,
    'interaction.backfilled',
    'contacts',
    c.id,
    jsonb_build_object(
      'source',     'last_touchpoint_denorm',
      'contact_id', c.id::text,
      'summary',    'last_touchpoint denorm copy'
    ),
    c.last_touchpoint
  FROM public.contacts c
  WHERE c.deleted_at IS NULL
    AND c.tier IN ('A', 'B', 'C')
    AND c.last_touchpoint IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.activity_events ae
      WHERE ae.context ->> 'source'     = 'last_touchpoint_denorm'
        AND ae.context ->> 'contact_id' = c.id::text
        AND ae.deleted_at IS NULL
    )
  RETURNING 1
)
SELECT COUNT(*) AS rows_inserted FROM inserted;

DO $$
DECLARE
  v_source   INT;
  v_backfill INT;
BEGIN
  SELECT COUNT(*) INTO v_source
    FROM public.contacts
   WHERE deleted_at IS NULL
     AND tier IN ('A', 'B', 'C')
     AND last_touchpoint IS NOT NULL;

  SELECT COUNT(*) INTO v_backfill
    FROM public.activity_events
   WHERE context ->> 'source' = 'last_touchpoint_denorm'
     AND deleted_at IS NULL;

  IF v_source <> 78 THEN
    RAISE EXCEPTION
      'Source drift: expected 78 A/B/C contacts with last_touchpoint, found %. State changed since this migration was authored. Re-confirm count and update the assertion before running.',
      v_source;
  END IF;

  IF v_backfill <> v_source THEN
    RAISE EXCEPTION
      'Backfill incomplete: % source rows but % activity_events rows with source=last_touchpoint_denorm.',
      v_source, v_backfill;
  END IF;

  RAISE NOTICE 'Backfill OK: % source rows match % activity_events rows.', v_source, v_backfill;
END;
$$;

COMMIT;
