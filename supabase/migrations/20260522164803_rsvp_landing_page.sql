-- RSVP Landing Page tables.
-- Adds two dedicated tables to back the /rsvp/[slug] public landing pages:
--   public.public_events    -- slug-keyed, publicly readable event metadata
--   public.event_rsvps      -- form submissions, service-role-only
-- The existing public.events table (calendar/gcal-tied) is untouched -- this
-- new pair separates public-facing RSVP concerns from internal calendar.
--
-- RLS strategy:
--   public_events: anon + authenticated can SELECT rows where status='live'.
--                  Writes are service-role only.
--   event_rsvps:   no anon/authenticated access. All reads + writes are
--                  service-role (POST /api/rsvp/submit uses adminClient).

BEGIN;

-- ------------------------------------------------------------------
-- 1. public_events
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.public_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  title           text NOT NULL,
  subtitle        text,
  address         text,
  event_start     timestamptz NOT NULL,
  event_end       timestamptz NOT NULL,
  host_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  hero_image_url  text,
  intro_copy      text,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'live', 'closed')),
  timezone        text NOT NULL DEFAULT 'America/Phoenix',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS public_events_slug_idx
  ON public.public_events (slug)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS public_events_status_idx
  ON public.public_events (status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.public_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_events_read_live ON public.public_events;
CREATE POLICY public_events_read_live ON public.public_events
  FOR SELECT
  TO anon, authenticated
  USING (status = 'live' AND deleted_at IS NULL);

-- service_role bypasses RLS by default; no explicit write policy needed.

-- ------------------------------------------------------------------
-- 2. event_rsvps
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES public.public_events(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  brokerage       text NOT NULL,
  email           text NOT NULL,
  phone           text,
  guest_count     integer NOT NULL DEFAULT 1
                  CHECK (guest_count BETWEEN 1 AND 2),
  notes           text,
  ip_address      text,
  user_agent      text,
  confirmation_message_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS event_rsvps_event_idx
  ON public.event_rsvps (event_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS event_rsvps_email_idx
  ON public.event_rsvps (lower(email))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS event_rsvps_created_idx
  ON public.event_rsvps (created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policy = no access. Service-role only.

-- ------------------------------------------------------------------
-- 3. updated_at trigger
-- ------------------------------------------------------------------
DROP TRIGGER IF EXISTS public_events_set_updated_at ON public.public_events;
CREATE TRIGGER public_events_set_updated_at
  BEFORE UPDATE ON public.public_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------
-- 4. Seed Berneil broker open event
-- ------------------------------------------------------------------
INSERT INTO public.public_events (
  slug, title, subtitle, address, event_start, event_end,
  hero_image_url, intro_copy, status, timezone
) VALUES (
  'berneil',
  'An Evening at Berneil',
  'A Private Broker Preview',
  '4901 East Berneil Drive, Paradise Valley, AZ 85253',
  '2026-05-29 16:00:00-07'::timestamptz,
  '2026-05-29 18:00:00-07'::timestamptz,
  NULL,
  'Champagne, music, and a home designed to be experienced in person. Reserve your spot below.',
  'live',
  'America/Phoenix'
) ON CONFLICT (slug) DO NOTHING;

COMMIT;
