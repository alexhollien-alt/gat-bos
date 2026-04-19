-- Phase 9 -- add email_drafts to supabase_realtime publication.
-- Root cause: Phase 1.3.1 migration created email_drafts and the DraftsPending
-- component (src/components/today/drafts-pending.tsx) subscribes to postgres_changes
-- on public.email_drafts via channel 'drafts_pending_today', but the table was never
-- added to supabase_realtime, so the subscription connects successfully yet never
-- receives INSERT/UPDATE/DELETE events. Idempotent per repo convention.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'email_drafts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.email_drafts;
    RAISE NOTICE 'Added email_drafts to supabase_realtime publication.';
  ELSE
    RAISE NOTICE 'email_drafts already in supabase_realtime publication.';
  END IF;
END $$;
