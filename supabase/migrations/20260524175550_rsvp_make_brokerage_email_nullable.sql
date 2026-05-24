-- RSVP form simplification: form now collects Name + Guest count only.
-- Brokerage was previously NOT NULL, email was previously NOT NULL. The CSV
-- upload becomes the source-of-truth for email + brokerage; the form just
-- captures attendance intent. Make both columns nullable so submissions
-- without those fields can persist.

ALTER TABLE public.event_rsvps
  ALTER COLUMN brokerage DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL;
