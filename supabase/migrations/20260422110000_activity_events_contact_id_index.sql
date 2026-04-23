-- Slice 1 fix: partial expression index on context->>'contact_id' so the
-- getContactTimeline OR-filter does not full-scan as the ledger grows.
-- Uses btree (default) since the predicate is text equality, not containment.
-- GIN is for jsonb containment operators (@>); this key is extracted as text.
create index if not exists activity_events_context_contact_id_idx
  on public.activity_events ((context->>'contact_id'))
  where context->>'contact_id' is not null;
