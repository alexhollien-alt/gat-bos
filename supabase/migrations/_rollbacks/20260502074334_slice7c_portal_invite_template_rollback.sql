-- Rollback for 20260502074334_slice7c_portal_invite_template.sql
-- Manually invoked. Soft-deletes the seeded row per Standing Rule 3
-- (no hard deletes). Re-running the forward migration after rollback will
-- overwrite the soft-delete via ON CONFLICT (slug, version) DO UPDATE; if
-- a clean re-seed is desired, also clear deleted_at in a follow-up step.

UPDATE public.templates
SET deleted_at = now()
WHERE slug = 'portal-invite'
  AND version = 1
  AND deleted_at IS NULL;
