-- Slice 8 -- Weekly Edge mass-send infrastructure
-- Phase 1 (PLUMBING): weekly_snapshot table
--
-- Stores one row per tracked market per ISO week. Source rows are populated
-- by the Altos pull cron (Mon 6 AM PHX) and consumed by the Weekly Edge
-- assembly cron (Tue 11 AM PHX). Shared market reference data, not
-- user-scoped (read-accessible to all authenticated users in this single-
-- tenant pilot; multi-account scoping deferred until Slice 8 goes
-- multi-tenant).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.weekly_snapshot (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_of         date NOT NULL,
  market_slug     text NOT NULL,
  market_label    text NOT NULL,
  data            jsonb NOT NULL,
  narrative_seed  text,
  pulled_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS weekly_snapshot_week_market_uniq
  ON public.weekly_snapshot (week_of, market_slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS weekly_snapshot_week_of_idx
  ON public.weekly_snapshot (week_of DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.weekly_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_snapshot_authenticated_read ON public.weekly_snapshot;
CREATE POLICY weekly_snapshot_authenticated_read
  ON public.weekly_snapshot
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS weekly_snapshot_service_role_all ON public.weekly_snapshot;
CREATE POLICY weekly_snapshot_service_role_all
  ON public.weekly_snapshot
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.weekly_snapshot IS
  'Slice 8: weekly market snapshots for Weekly Edge campaign. One row per (week_of, market_slug). Populated by Altos pull cron, consumed by weekly-edge-assemble cron.';
COMMENT ON COLUMN public.weekly_snapshot.week_of IS 'Monday of the ISO week (date, no time).';
COMMENT ON COLUMN public.weekly_snapshot.market_slug IS 'Tracked-market identifier, e.g. scottsdale-85258-sf. Source of truth: src/lib/markets/tracked.ts.';
COMMENT ON COLUMN public.weekly_snapshot.data IS 'Raw Altos payload subset: median_price, dom, inventory, absorption, mom_delta, yoy_delta. Schema enforced by writer; jsonb here for forward flexibility.';
COMMENT ON COLUMN public.weekly_snapshot.narrative_seed IS 'Optional human-curated note prepended to writer prompt; null on cron-pulled rows.';
COMMENT ON COLUMN public.weekly_snapshot.deleted_at IS 'Soft delete (Standing Rule 3). Partial unique index excludes soft-deleted rows so a row can be re-pulled after deletion.';
