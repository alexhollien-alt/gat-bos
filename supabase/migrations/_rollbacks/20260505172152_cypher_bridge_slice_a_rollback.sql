-- Rollback for 20260505172152_cypher_bridge_slice_a.sql
-- Drops Cypher Bridge tables and enums. Does not affect material_requests.

BEGIN;

DROP TABLE IF EXISTS public.ticket_projects CASCADE;
DROP TABLE IF EXISTS public.tickets CASCADE;

DROP TYPE IF EXISTS ticket_status CASCADE;
DROP TYPE IF EXISTS ticket_priority CASCADE;
DROP TYPE IF EXISTS ticket_category CASCADE;

DROP FUNCTION IF EXISTS update_tickets_updated_at() CASCADE;

COMMIT;
