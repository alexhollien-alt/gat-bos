-- Bind the seeded Berneil broker open event to Denise van den Bossche's
-- contacts row so the public RSVP page + confirmation email read host
-- metadata from one source instead of a hardcoded HOST_BY_SLUG map.
--
-- Looking up by email keeps this migration idempotent if a future reset
-- regenerates the contact uuid.

BEGIN;

UPDATE public.public_events pe
SET host_contact_id = c.id
FROM public.contacts c
WHERE pe.slug = 'berneil'
  AND pe.host_contact_id IS NULL
  AND lower(c.email) = 'denisevdb@exec-elite.com'
  AND c.deleted_at IS NULL;

COMMIT;
