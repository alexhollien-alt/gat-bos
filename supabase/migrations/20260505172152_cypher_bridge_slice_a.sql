-- Cypher Bridge Slice A: new tickets + ticket_projects tables
-- Phase 2 of radiant-percolating-bengio.md
-- Distinct namespace from legacy material_requests (renamed in prior migration).

BEGIN;

-- Enums (drop+create for idempotency)
DROP TYPE IF EXISTS ticket_category CASCADE;
CREATE TYPE ticket_category AS ENUM ('General Inquiry', 'Product Request');

DROP TYPE IF EXISTS ticket_priority CASCADE;
CREATE TYPE ticket_priority AS ENUM ('Low', 'Normal', 'High', 'Urgent');

DROP TYPE IF EXISTS ticket_status CASCADE;
CREATE TYPE ticket_status AS ENUM (
  'draft',
  'submitted',
  'awaiting_reply',
  'in_progress',
  'done',
  'blocked',
  'cancelled'
);

-- Main tickets table
DROP TABLE IF EXISTS public.ticket_projects CASCADE;
DROP TABLE IF EXISTS public.tickets CASCADE;

CREATE TABLE public.tickets (
  id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid            NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  cypher_id           text            UNIQUE,
  cypher_url          text,
  ticket_title        text            NOT NULL,
  description         text            NOT NULL,
  priority            ticket_priority NOT NULL DEFAULT 'Normal',
  due_date            date,
  branch_association  text            NOT NULL,
  ship_to_location    text            NOT NULL,
  contact_id          uuid            REFERENCES contacts(id),
  client_first_name   text,
  client_last_name    text,
  client_company      text,
  client_email        text,
  client_phone        text,
  client_mobile_phone text,
  status              ticket_status   NOT NULL DEFAULT 'draft',
  assigned_to         text,
  raw_brain_dump      text,
  created_at          timestamptz     NOT NULL DEFAULT now(),
  updated_at          timestamptz     NOT NULL DEFAULT now(),
  synced_at           timestamptz,
  deleted_at          timestamptz
);

-- Child table: one row per project line on a ticket
CREATE TABLE public.ticket_projects (
  id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id           uuid            NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  project_number      int             NOT NULL,
  category            ticket_category NOT NULL DEFAULT 'Product Request',
  product             text            NOT NULL,
  paper_type          text,
  brochure_type       text,
  flyer_paper_type    text,
  quantity            int,
  number_of_sheets    int,
  total_project_cost  numeric(10,2),
  created_at          timestamptz     NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, project_number)
);

-- Indexes
CREATE INDEX tickets_status_idx             ON tickets(status)        WHERE deleted_at IS NULL;
CREATE INDEX tickets_contact_idx            ON tickets(contact_id);
CREATE INDEX tickets_cypher_id_idx          ON tickets(cypher_id);
CREATE INDEX tickets_created_at_idx         ON tickets(created_at DESC);
CREATE INDEX tickets_account_id_idx         ON tickets(account_id);
CREATE INDEX ticket_projects_ticket_id_idx  ON ticket_projects(ticket_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_tickets_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS tickets_updated_at ON tickets;
CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_tickets_updated_at();

-- RLS: tickets (account-scoped, Slice 7B pattern)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tickets_account_select ON tickets;
CREATE POLICY tickets_account_select ON tickets
  FOR SELECT TO authenticated
  USING (account_id IN (
    SELECT id FROM accounts
    WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
  ));

DROP POLICY IF EXISTS tickets_account_insert ON tickets;
CREATE POLICY tickets_account_insert ON tickets
  FOR INSERT TO authenticated
  WITH CHECK (account_id IN (
    SELECT id FROM accounts
    WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
  ));

DROP POLICY IF EXISTS tickets_account_update ON tickets;
CREATE POLICY tickets_account_update ON tickets
  FOR UPDATE TO authenticated
  USING      (account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid() AND deleted_at IS NULL))
  WITH CHECK (account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid() AND deleted_at IS NULL));

DROP POLICY IF EXISTS tickets_account_delete ON tickets;
CREATE POLICY tickets_account_delete ON tickets
  FOR DELETE TO authenticated
  USING (account_id IN (
    SELECT id FROM accounts
    WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
  ));

-- RLS: ticket_projects (inherits account scope via ticket_id join)
ALTER TABLE public.ticket_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ticket_projects_account_select ON ticket_projects;
CREATE POLICY ticket_projects_account_select ON ticket_projects
  FOR SELECT TO authenticated
  USING (ticket_id IN (
    SELECT id FROM tickets
    WHERE account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
      AND deleted_at IS NULL
  ));

DROP POLICY IF EXISTS ticket_projects_account_insert ON ticket_projects;
CREATE POLICY ticket_projects_account_insert ON ticket_projects
  FOR INSERT TO authenticated
  WITH CHECK (ticket_id IN (
    SELECT id FROM tickets
    WHERE account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
      AND deleted_at IS NULL
  ));

DROP POLICY IF EXISTS ticket_projects_account_update ON ticket_projects;
CREATE POLICY ticket_projects_account_update ON ticket_projects
  FOR UPDATE TO authenticated
  USING (ticket_id IN (
    SELECT id FROM tickets
    WHERE account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
      AND deleted_at IS NULL
  ))
  WITH CHECK (ticket_id IN (
    SELECT id FROM tickets
    WHERE account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
      AND deleted_at IS NULL
  ));

DROP POLICY IF EXISTS ticket_projects_account_delete ON ticket_projects;
CREATE POLICY ticket_projects_account_delete ON ticket_projects
  FOR DELETE TO authenticated
  USING (ticket_id IN (
    SELECT id FROM tickets
    WHERE account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
      AND deleted_at IS NULL
  ));

COMMIT;
