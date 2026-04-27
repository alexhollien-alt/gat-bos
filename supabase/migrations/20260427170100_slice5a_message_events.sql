-- Slice 5A Task 2 -- message_events table + status-sync trigger
-- Captures Resend webhook events linked to messages_log; trigger advances
-- messages_log.status to reflect the latest meaningful state.

-- Event type enum (separate from message_status so 'complained' can exist as
-- an event without expanding the messages_log.status enum).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_event_type') THEN
    CREATE TYPE public.message_event_type AS ENUM (
      'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_log_id uuid NOT NULL REFERENCES public.messages_log(id) ON DELETE CASCADE,
  event_type public.message_event_type NOT NULL,
  provider_message_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_events_log_received
  ON public.message_events (message_log_id, received_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.message_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alex_message_events_all ON public.message_events;
CREATE POLICY alex_message_events_all ON public.message_events
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'alex@alexhollienco.com');

-- Status sync function. Behavior:
--   * Terminal sticky: once messages_log.status is bounced or failed, never roll back.
--   * Otherwise advance forward through queued -> sent -> delivered -> opened -> clicked.
--   * Event 'complained' maps to messages_log.status='bounced' (terminal).
CREATE OR REPLACE FUNCTION public.update_message_log_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  current_status public.message_status;
  new_status public.message_status;
  rank_current int;
  rank_new int;
BEGIN
  SELECT status INTO current_status
  FROM public.messages_log
  WHERE id = NEW.message_log_id;

  IF current_status IS NULL THEN
    RETURN NEW;
  END IF;

  IF current_status IN ('bounced', 'failed') THEN
    RETURN NEW;
  END IF;

  new_status := CASE NEW.event_type
    WHEN 'sent' THEN 'sent'::public.message_status
    WHEN 'delivered' THEN 'delivered'::public.message_status
    WHEN 'opened' THEN 'opened'::public.message_status
    WHEN 'clicked' THEN 'clicked'::public.message_status
    WHEN 'bounced' THEN 'bounced'::public.message_status
    WHEN 'complained' THEN 'bounced'::public.message_status
  END;

  rank_current := CASE current_status
    WHEN 'queued' THEN 0
    WHEN 'sent' THEN 1
    WHEN 'delivered' THEN 2
    WHEN 'opened' THEN 3
    WHEN 'clicked' THEN 4
    WHEN 'bounced' THEN 99
    WHEN 'failed' THEN 99
    ELSE 0
  END;

  rank_new := CASE new_status
    WHEN 'sent' THEN 1
    WHEN 'delivered' THEN 2
    WHEN 'opened' THEN 3
    WHEN 'clicked' THEN 4
    WHEN 'bounced' THEN 99
    ELSE 0
  END;

  IF rank_new > rank_current THEN
    UPDATE public.messages_log
    SET status = new_status
    WHERE id = NEW.message_log_id;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS message_events_status_sync ON public.message_events;
CREATE TRIGGER message_events_status_sync
  AFTER INSERT ON public.message_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_message_log_status();
