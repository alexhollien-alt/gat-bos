-- Slice 4 Task 2 -- messages_log table.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status') THEN
    CREATE TYPE public.message_status AS ENUM (
      'queued', 'sent', 'delivered', 'bounced', 'opened', 'clicked', 'failed'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.messages_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id           UUID NOT NULL REFERENCES public.templates(id) ON DELETE RESTRICT,
  recipient_email       TEXT NOT NULL,
  send_mode             public.template_send_mode NOT NULL,
  provider_message_id   TEXT,
  status                public.message_status NOT NULL DEFAULT 'queued',
  event_sequence        JSONB NOT NULL DEFAULT '[]'::jsonb,
  sent_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_log_template_sent
  ON public.messages_log (template_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_log_status_live
  ON public.messages_log (status, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.messages_log IS
  'Per-send audit row for the messaging abstraction. status flows queued -> sent -> delivered/bounced/opened/clicked or failed. event_sequence is an append-only jsonb array (timestamp + event payload), mirrors email_drafts.audit_log shape. RLS Alex-only.';

ALTER TABLE public.messages_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alex_messages_log_all" ON public.messages_log;

CREATE POLICY "alex_messages_log_all" ON public.messages_log
  FOR ALL TO authenticated
  USING      (auth.jwt() ->> 'email' = 'alex@alexhollienco.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alex@alexhollienco.com');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages_log TO authenticated;
GRANT USAGE ON TYPE public.message_status TO authenticated, service_role;