-- ============================================================
-- PHASE 1.3.2-C -- OBSERVATION INSTRUMENTATION
-- View:  email_drafts_observation
-- RLS:   alex-only via security_invoker (inherits from email_drafts,
--        emails, contacts policies already enabled in earlier phases)
-- ============================================================
-- Plan: ~/.claude/plans/phase-1.3.2.md (Phase C)
--
-- How to run:
--   Open Supabase SQL Editor. Paste this file. Run. Expect "COMMIT".
--
-- Idempotent: DROP VIEW IF EXISTS ... CASCADE before CREATE. Re-running
-- fully rebuilds the view. No data loss (view only; zero storage).
--
-- Columns (per plan Phase C task 1):
--   draft_id, contact_id, contact_tier, escalation_flag,
--   action_taken, generated_at, acted_at,
--   time_to_action_seconds, was_revised
--
-- action_taken derivation (from audit_log.event_sequence):
--   sent_via_resend       -> 'send_now'
--   sent_via_gmail_draft  -> 'create_gmail_draft'
--   user_discarded        -> 'discarded'
--   (no terminal event)   -> NULL (still pending / expired without action)
--
-- was_revised: true when any user_revised event appears in event_sequence.
--
-- RLS: security_invoker=true so the view executes as the querying role.
-- email_drafts + emails + contacts RLS policies gate access. service_role
-- bypasses RLS (used by readout helpers) per standard Supabase pattern.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Clean slate (idempotency)
-- ------------------------------------------------------------
DROP VIEW IF EXISTS public.email_drafts_observation CASCADE;

-- ------------------------------------------------------------
-- email_drafts_observation: per-draft readout surface for Phase E
-- ------------------------------------------------------------
CREATE VIEW public.email_drafts_observation
WITH (security_invoker = 'true') AS
WITH terminal AS (
  SELECT
    d.id AS draft_id,
    (
      SELECT ev
      FROM jsonb_array_elements(
             COALESCE(d.audit_log -> 'event_sequence', '[]'::jsonb)
           ) AS ev
      WHERE ev ->> 'event' IN (
        'sent_via_resend',
        'sent_via_gmail_draft',
        'user_discarded'
      )
      ORDER BY (ev ->> 'timestamp')::timestamptz DESC
      LIMIT 1
    ) AS terminal_ev,
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
             COALESCE(d.audit_log -> 'event_sequence', '[]'::jsonb)
           ) AS ev
      WHERE ev ->> 'event' = 'user_revised'
    ) AS was_revised
  FROM public.email_drafts d
)
SELECT
  d.id                             AS draft_id,
  e.contact_id                     AS contact_id,
  c.tier                           AS contact_tier,
  d.escalation_flag                AS escalation_flag,
  CASE t.terminal_ev ->> 'event'
    WHEN 'sent_via_resend'      THEN 'send_now'
    WHEN 'sent_via_gmail_draft' THEN 'create_gmail_draft'
    WHEN 'user_discarded'       THEN 'discarded'
    ELSE NULL
  END                              AS action_taken,
  d.generated_at                   AS generated_at,
  CASE
    WHEN t.terminal_ev IS NOT NULL
    THEN (t.terminal_ev ->> 'timestamp')::timestamptz
    ELSE NULL
  END                              AS acted_at,
  CASE
    WHEN t.terminal_ev IS NOT NULL
    THEN EXTRACT(
           EPOCH FROM (
             (t.terminal_ev ->> 'timestamp')::timestamptz - d.generated_at
           )
         )::int
    ELSE NULL
  END                              AS time_to_action_seconds,
  COALESCE(t.was_revised, false)   AS was_revised
FROM public.email_drafts d
JOIN public.emails       e ON e.id = d.email_id
LEFT JOIN public.contacts c ON c.id = e.contact_id
LEFT JOIN terminal       t ON t.draft_id = d.id;

COMMENT ON VIEW public.email_drafts_observation IS
  'Phase 1.3.2-C per-draft readout surface. Joins email_drafts -> emails -> contacts for tier context and derives action_taken from the terminal event in audit_log.event_sequence. security_invoker=true so RLS on the underlying tables applies; alex-only in single-user mode.';

GRANT SELECT ON public.email_drafts_observation TO authenticated, service_role;

COMMIT;

-- ============================================================
-- VERIFY (run after commit, as Alex)
-- ============================================================
--
-- SELECT count(*) FROM public.email_drafts_observation;
-- -- expect the same count as public.email_drafts for the current session.
--
-- SELECT action_taken, count(*)
-- FROM public.email_drafts_observation
-- GROUP BY 1 ORDER BY 1 NULLS FIRST;
-- -- expect rows like: (null, N), ('discarded', N), ('send_now', N),
-- --                   ('create_gmail_draft', N)
--
-- SELECT contact_tier, count(*)
-- FROM public.email_drafts_observation
-- GROUP BY 1 ORDER BY 1 NULLS FIRST;
-- -- expect tier distribution across A/B/C/P/null.
--
-- ============================================================
