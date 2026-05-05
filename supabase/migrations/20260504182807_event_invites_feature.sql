-- 2026-05-04 -- EventInvite feature
--
-- Extends existing public.events (Slice 1.5 calendar table) with
-- invite-shaped columns, creates public.event_invites for the (event,
-- contact) pair ledger, and provisions the event-assets storage bucket.
--
-- The events table already carries account_id (Slice 7B) and user_id
-- (Slice 7A) plus account-scoped RLS. event_invites mirrors that shape.
-- All writes are soft-delete (no hard deletes per Standing Rule 3).

BEGIN;

-- 1. Extend events with invite-only columns
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS slots_total int,
  ADD COLUMN IF NOT EXISTS slots_remaining int,
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS cohost_names text[],
  ADD COLUMN IF NOT EXISTS cohost_orgs text[];

-- 2. event_invites: one row per (event, contact) pair
CREATE TABLE IF NOT EXISTS public.event_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued','test_sent','approved','sent','failed',
      'bounced','opened','clicked','rsvp_yes','rsvp_no'
    )),
  sent_at timestamptz,
  message_log_id uuid REFERENCES public.messages_log(id),
  bounce_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS event_invites_event_contact_unique
  ON public.event_invites (event_id, contact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS event_invites_event_status_idx
  ON public.event_invites (event_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS event_invites_contact_idx
  ON public.event_invites (contact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS event_invites_account_idx
  ON public.event_invites (account_id) WHERE deleted_at IS NULL;

-- updated_at trigger (set_updated_at function from Slice 7B)
DROP TRIGGER IF EXISTS event_invites_set_updated_at ON public.event_invites;
CREATE TRIGGER event_invites_set_updated_at
  BEFORE UPDATE ON public.event_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. RLS: account-scoped (matches events / agent_invites pattern)
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_invites_account_select ON public.event_invites;
CREATE POLICY event_invites_account_select ON public.event_invites
  FOR SELECT TO authenticated
  USING (account_id IN (
    SELECT id FROM public.accounts
    WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
  ));

DROP POLICY IF EXISTS event_invites_account_insert ON public.event_invites;
CREATE POLICY event_invites_account_insert ON public.event_invites
  FOR INSERT TO authenticated
  WITH CHECK (account_id IN (
    SELECT id FROM public.accounts
    WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
  ));

DROP POLICY IF EXISTS event_invites_account_update ON public.event_invites;
CREATE POLICY event_invites_account_update ON public.event_invites
  FOR UPDATE TO authenticated
  USING (account_id IN (
    SELECT id FROM public.accounts
    WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
  ))
  WITH CHECK (account_id IN (
    SELECT id FROM public.accounts
    WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
  ));

DROP POLICY IF EXISTS event_invites_account_delete ON public.event_invites;
CREATE POLICY event_invites_account_delete ON public.event_invites
  FOR DELETE TO authenticated
  USING (account_id IN (
    SELECT id FROM public.accounts
    WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
  ));

REVOKE ALL ON public.event_invites FROM anon;

-- 4. Storage bucket: event-assets (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-assets', 'event-assets', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS event_assets_public_read ON storage.objects;
CREATE POLICY event_assets_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'event-assets');

DROP POLICY IF EXISTS event_assets_authenticated_write ON storage.objects;
CREATE POLICY event_assets_authenticated_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-assets');

DROP POLICY IF EXISTS event_assets_authenticated_update ON storage.objects;
CREATE POLICY event_assets_authenticated_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'event-assets')
  WITH CHECK (bucket_id = 'event-assets');

COMMIT;
