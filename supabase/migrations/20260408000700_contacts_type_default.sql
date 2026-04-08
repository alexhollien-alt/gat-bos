-- Add a default value of 'realtor' to contacts.type so callers that omit
-- the field do not 500 against the NOT NULL constraint. The CHECK
-- constraint contacts_type_check still enforces the allowed enum, so a
-- default cannot introduce an invalid value. Existing rows are unaffected;
-- this only sets a column-level default for future inserts.
--
-- The contact form should still set type explicitly when the user is
-- creating a non-realtor contact (lender, vendor, builder, etc.). This
-- default is a safety net for API callers and bulk inserts, not the
-- source of truth for the form path.

ALTER TABLE public.contacts
  ALTER COLUMN type SET DEFAULT 'realtor';
