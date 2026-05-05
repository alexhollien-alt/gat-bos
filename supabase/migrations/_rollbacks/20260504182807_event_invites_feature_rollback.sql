-- 2026-05-04 -- EventInvite feature rollback
-- Reverses 20260504182807_event_invites_feature.sql
-- Order: storage policies -> bucket -> event_invites RLS -> table -> events column drops

BEGIN;

DROP POLICY IF EXISTS event_assets_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS event_assets_authenticated_write ON storage.objects;
DROP POLICY IF EXISTS event_assets_public_read ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'event-assets';

DROP POLICY IF EXISTS event_invites_account_delete ON public.event_invites;
DROP POLICY IF EXISTS event_invites_account_update ON public.event_invites;
DROP POLICY IF EXISTS event_invites_account_insert ON public.event_invites;
DROP POLICY IF EXISTS event_invites_account_select ON public.event_invites;
DROP TRIGGER IF EXISTS event_invites_set_updated_at ON public.event_invites;
DROP TABLE IF EXISTS public.event_invites;

ALTER TABLE public.events
  DROP COLUMN IF EXISTS cohost_orgs,
  DROP COLUMN IF EXISTS cohost_names,
  DROP COLUMN IF EXISTS hero_image_url,
  DROP COLUMN IF EXISTS slots_remaining,
  DROP COLUMN IF EXISTS slots_total;

COMMIT;
