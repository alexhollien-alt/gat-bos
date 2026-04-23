-- Slice 1: Universal activity ledger.
-- Every user-observable action in GAT-BOS writes a row here.
-- Idempotent: safe to run twice.

CREATE TABLE IF NOT EXISTS public.activity_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  actor_id      uuid NOT NULL,
  verb          text NOT NULL,
  object_table  text NOT NULL,
  object_id     uuid NOT NULL,
  context       jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_events_user_occurred
  ON public.activity_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_object
  ON public.activity_events (object_table, object_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_actor
  ON public.activity_events (actor_id, occurred_at DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_read_write" ON public.activity_events;
CREATE POLICY "owner_read_write"
  ON public.activity_events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
