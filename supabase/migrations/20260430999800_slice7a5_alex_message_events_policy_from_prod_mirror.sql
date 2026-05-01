-- Slice 7A.5 reconciliation: prod-only single-tenant policy mirror.
-- Prod retains "alex_message_events_all" on public.message_events from before
-- Slice 7A's RLS rewrite. Slice 7A added "message_events_user_isolation"
-- (user_id-based) and intended to drop this policy, but the DROP never executed
-- in prod. Local schema must mirror prod's stale state for byte-equivalence
-- with `pg_dump --schema-only`. Slice 7B will drop this policy in prod via a
-- forward DROP POLICY migration.
--
-- Effective behavior in prod today: alex@alexhollienco.com retains a USING +
-- WITH CHECK bypass on message_events; all other users are constrained by
-- "message_events_user_isolation" (user_id = auth.uid()). Mirroring this to
-- local replicates prod's RLS surface for dev/test parity.

DROP POLICY IF EXISTS "alex_message_events_all" ON "public"."message_events";

CREATE POLICY "alex_message_events_all" ON "public"."message_events"
    USING ((("auth"."jwt"() ->> 'email'::"text") = 'alex@alexhollienco.com'::"text"))
    WITH CHECK ((("auth"."jwt"() ->> 'email'::"text") = 'alex@alexhollienco.com'::"text"));
