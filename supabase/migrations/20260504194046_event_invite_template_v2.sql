-- event-invite template v2: shorter, conversational subject line
-- v1 subject: "{{test_prefix}}{{first_name}}, you are invited to {{event_name}} on {{event_date}}"
-- v2 subject: "{{test_prefix}}{{first_name}}, Christine and I are filming Thursday. Come grab content."
-- Reason: Alex selected modified Option 1 (2026-05-04). Conversational, names the partner,
-- frames the value in plain language. {{test_prefix}} preserved so [TEST] sends keep working.
-- Body unchanged from v1; only the subject diverges.

INSERT INTO templates (
  name,
  slug,
  send_mode,
  subject,
  body_html,
  body_text,
  kind,
  version,
  user_id
)
SELECT
  name,
  slug,
  send_mode,
  '{{test_prefix}}{{first_name}}, Christine and I are filming Thursday. Come grab content.' AS subject,
  body_html,
  body_text,
  kind,
  2 AS version,
  user_id
FROM templates
WHERE slug = 'event-invite'
  AND version = 1
  AND deleted_at IS NULL
ON CONFLICT DO NOTHING;
