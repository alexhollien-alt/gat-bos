-- Rollback: reverse the Phase 1 rename (material_requests -> tickets, material_request_items -> ticket_items)

BEGIN;

-- 4. Restore FK constraint name
ALTER TABLE public.material_request_items
  RENAME CONSTRAINT material_request_items_material_request_id_fkey TO ticket_items_ticket_id_fkey;

-- 3. Restore secondary indexes
ALTER INDEX public.idx_material_requests_contact RENAME TO idx_tickets_contact;
ALTER INDEX public.idx_material_requests_source RENAME TO idx_tickets_source;
ALTER INDEX public.idx_material_requests_status RENAME TO idx_tickets_status;
ALTER INDEX public.idx_material_requests_user RENAME TO idx_tickets_user;
ALTER INDEX public.idx_material_request_items_material_request RENAME TO idx_ticket_items_ticket;

-- 2. Restore primary key indexes
ALTER INDEX public.material_requests_pkey RENAME TO tickets_pkey;
ALTER INDEX public.material_request_items_pkey RENAME TO ticket_items_pkey;

-- 1. Restore table names
ALTER TABLE public.material_request_items RENAME TO ticket_items;
ALTER TABLE public.material_requests RENAME TO tickets;

COMMIT;
