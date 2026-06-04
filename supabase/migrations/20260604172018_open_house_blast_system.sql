-- Open House Blast System: data layer
-- Adds city tagging + send-status (suppression list) + unsubscribe token to contacts,
-- and creates open_house_blasts + blast_sends. Account-scoped RLS mirrors contacts.
-- Idempotent: IF NOT EXISTS / DROP ... IF EXISTS throughout.

BEGIN;

-- ============================================================================
-- 1. CONTACTS: city tag, send-status (doubles as suppression list), unsub token
-- ============================================================================
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS city                 text,
  ADD COLUMN IF NOT EXISTS email_status         text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS email_status_reason  text,
  ADD COLUMN IF NOT EXISTS email_status_at      timestamp with time zone,
  ADD COLUMN IF NOT EXISTS unsubscribe_token    uuid NOT NULL DEFAULT gen_random_uuid();

-- email_status is the suppression mechanism. Only 'active' is mailable.
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_email_status_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_email_status_check
  CHECK (email_status = ANY (ARRAY[
    'active', 'unsubscribed', 'bounced', 'complained', 'manual_suppressed'
  ]));

-- One unsubscribe token per contact (one-click List-Unsubscribe target).
CREATE UNIQUE INDEX IF NOT EXISTS contacts_unsubscribe_token_unique
  ON public.contacts (unsubscribe_token);

-- City match index (case-insensitive) for recipient segmentation.
CREATE INDEX IF NOT EXISTS contacts_city_lower_idx
  ON public.contacts (lower(city))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS contacts_email_status_idx
  ON public.contacts (email_status)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. OPEN_HOUSE_BLASTS: one row per open-house campaign
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.open_house_blasts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  user_id             uuid NOT NULL DEFAULT auth.uid(),
  agent_contact_id    uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  slug                text NOT NULL,                 -- landing page url key

  -- listing details (the one short form)
  address             text NOT NULL,
  city                text NOT NULL,                 -- segmentation key
  state               text DEFAULT 'AZ',
  price               text,                          -- display string, e.g. "$1,295,000"
  open_house_date     date NOT NULL,
  open_house_start    time,
  open_house_end      time,
  details             text,                          -- freeform highlights
  beds                numeric,
  baths               numeric,
  sqft                integer,
  photos              text[] DEFAULT '{}',           -- 1 to 2 photo urls
  hero_image_url      text,                          -- primary photo

  -- email
  email_subject       text,
  email_preheader     text,

  -- workflow + warmup
  status              text NOT NULL DEFAULT 'draft', -- draft|preview|sending|sent|canceled
  auto_send           boolean NOT NULL DEFAULT false,
  recipient_count     integer DEFAULT 0,
  daily_send_cap      integer,                       -- null = no warmup cap

  -- timestamps
  approved_at         timestamp with time zone,
  sending_started_at  timestamp with time zone,
  sent_at             timestamp with time zone,
  created_at          timestamp with time zone NOT NULL DEFAULT now(),
  updated_at          timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at          timestamp with time zone,

  CONSTRAINT open_house_blasts_status_check
    CHECK (status = ANY (ARRAY['draft','preview','sending','sent','canceled']))
);

CREATE UNIQUE INDEX IF NOT EXISTS open_house_blasts_slug_unique
  ON public.open_house_blasts (slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS open_house_blasts_account_idx
  ON public.open_house_blasts (account_id)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. BLAST_SENDS: one row per recipient per blast (the send ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.blast_sends (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blast_id            uuid NOT NULL REFERENCES public.open_house_blasts(id) ON DELETE CASCADE,
  account_id          uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  contact_id          uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  recipient_email     text NOT NULL,
  recipient_name      text,
  provider_message_id text,                          -- Resend message id
  batch_number        integer,
  status              text NOT NULL DEFAULT 'queued',
  error_message       text,
  queued_at           timestamp with time zone NOT NULL DEFAULT now(),
  sent_at             timestamp with time zone,
  delivered_at        timestamp with time zone,
  opened_at           timestamp with time zone,
  clicked_at          timestamp with time zone,
  bounced_at          timestamp with time zone,
  complained_at       timestamp with time zone,
  created_at          timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at          timestamp with time zone,

  CONSTRAINT blast_sends_status_check
    CHECK (status = ANY (ARRAY[
      'queued','sent','delivered','opened','clicked','bounced','complained','failed','suppressed'
    ]))
);

CREATE INDEX IF NOT EXISTS blast_sends_blast_idx
  ON public.blast_sends (blast_id);

CREATE INDEX IF NOT EXISTS blast_sends_provider_msg_idx
  ON public.blast_sends (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- No double-send to the same recipient within one blast (SCAR guard).
CREATE UNIQUE INDEX IF NOT EXISTS blast_sends_blast_email_unique
  ON public.blast_sends (blast_id, lower(recipient_email))
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 4. RLS: account-scoped for dashboard; anon read on live landing pages
-- ============================================================================
ALTER TABLE public.open_house_blasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blast_sends       ENABLE ROW LEVEL SECURITY;

-- open_house_blasts: owner full access
DROP POLICY IF EXISTS oh_blasts_account_all ON public.open_house_blasts;
CREATE POLICY oh_blasts_account_all
  ON public.open_house_blasts
  FOR ALL
  TO authenticated
  USING (
    account_id IN (SELECT id FROM public.accounts
                    WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
  )
  WITH CHECK (
    account_id IN (SELECT id FROM public.accounts
                    WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
  );

-- open_house_blasts: anon may read a published landing page only
DROP POLICY IF EXISTS oh_blasts_public_read ON public.open_house_blasts;
CREATE POLICY oh_blasts_public_read
  ON public.open_house_blasts
  FOR SELECT
  TO anon, authenticated
  USING (
    status = ANY (ARRAY['preview','sending','sent'])
    AND deleted_at IS NULL
  );

-- blast_sends: owner full access (no public read)
DROP POLICY IF EXISTS blast_sends_account_all ON public.blast_sends;
CREATE POLICY blast_sends_account_all
  ON public.blast_sends
  FOR ALL
  TO authenticated
  USING (
    account_id IN (SELECT id FROM public.accounts
                    WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
  )
  WITH CHECK (
    account_id IN (SELECT id FROM public.accounts
                    WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
  );

COMMIT;
