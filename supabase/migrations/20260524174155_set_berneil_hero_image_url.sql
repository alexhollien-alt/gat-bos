-- Set hero_image_url for the Berneil broker-open RSVP landing page.
-- The original seed in 20260522164803_rsvp_landing_page.sql left it NULL,
-- which made /rsvp/berneil render the "Hero photo coming soon" placeholder.
-- Point it at the hosted asset already used by the email.

UPDATE public.public_events
   SET hero_image_url = 'https://gat-bos.vercel.app/email-assets/berneil/hero-photo.jpg'
 WHERE slug = 'berneil'
   AND deleted_at IS NULL;
