-- Rollback for event-invite template v2 seed.
-- Soft-delete the v2 row so v1 stays canonical for future sends.
-- Per Standing Rule 3 (no hard deletes), uses deleted_at not DELETE.

UPDATE templates
SET deleted_at = now()
WHERE slug = 'event-invite'
  AND version = 2
  AND deleted_at IS NULL;
