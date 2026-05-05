-- Phase 1: Rename legacy tickets/ticket_items to material_requests/material_request_items
-- Frees the "tickets" namespace for the Cypher Bridge (Slice A Phase 2+).
-- All data, FKs, indexes, triggers, and RLS policies carry over via Postgres rename semantics.

BEGIN;

-- 1. Rename tables
ALTER TABLE public.tickets RENAME TO material_requests;
ALTER TABLE public.ticket_items RENAME TO material_request_items;

-- 2. Rename primary key indexes (pkey unique indexes follow the constraint name separately)
ALTER INDEX public.tickets_pkey RENAME TO material_requests_pkey;
ALTER INDEX public.ticket_items_pkey RENAME TO material_request_items_pkey;

-- 3. Rename secondary indexes
ALTER INDEX public.idx_tickets_contact RENAME TO idx_material_requests_contact;
ALTER INDEX public.idx_tickets_source RENAME TO idx_material_requests_source;
ALTER INDEX public.idx_tickets_status RENAME TO idx_material_requests_status;
ALTER INDEX public.idx_tickets_user RENAME TO idx_material_requests_user;
ALTER INDEX public.idx_ticket_items_ticket RENAME TO idx_material_request_items_material_request;

-- 4. Rename FK constraint on material_request_items that references material_requests
--    (material_requests_contact_id_fkey and material_requests_user_id_fkey are already correct)
ALTER TABLE public.material_request_items
  RENAME CONSTRAINT ticket_items_ticket_id_fkey TO material_request_items_material_request_id_fkey;

COMMIT;
