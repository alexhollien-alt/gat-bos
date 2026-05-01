-- Slice 5B Task 7a -- Daily touchpoint summary template seed
--
-- Mirror of paste-file PASTE-INTO-SUPABASE-slice5b-daily-summary-template.sql,
-- executed in Supabase SQL Editor on 2026-04-27. Reproducible from clean DB.
--
-- Fired by /api/cron/touchpoint-reminder (`0 12 * * *` UTC, 5am MST).
-- Tokens: {{date}}, {{count_total}}, {{rows_html}}, {{overflow_count}},
-- {{rows_text}}. Resolved by cron route before sendMessage.
--
-- Kit 1 fonts (email default), inlined for client compatibility. Brand
-- voice: warm, specific. No banned words, no exclamations, no em dashes.
--
-- Idempotency: ON CONFLICT (slug, version) DO UPDATE.
-- 7A.5 fix: removed explicit BEGIN/COMMIT -- Supabase CLI auto-wraps each
-- migration in a transaction and the explicit pair triggers
-- "cannot insert multiple commands into a prepared statement" on replay.

INSERT INTO public.templates (slug, version, name, send_mode, kind, subject, body_html, body_text)
VALUES
  (
    'daily-touchpoint-summary',
    1,
    'Daily Touchpoint Summary',
    'resend',
    'transactional',
    E'Touchpoints due this week -- {{date}}',
    E'<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>Touchpoints due this week</title>\n</head>\n<body style="margin:0;padding:0;background:#f7f7f5;font-family:Inter,Helvetica,Arial,sans-serif;color:#0a0a0a;">\n<div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;">\n  <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#666666;margin:0 0 8px 0;">{{date}}</p>\n  <h1 style="font-family:\'Instrument Serif\',Georgia,serif;font-size:32px;line-height:1.2;color:#0a0a0a;margin:0 0 24px 0;font-weight:400;">Here is what is due this week</h1>\n  <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#0a0a0a;margin:0 0 24px 0;">{{count_total}} touchpoints and tasks are due this week or overdue. The list below is sorted by due date.</p>\n  <ul style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0a0a0a;padding-left:20px;margin:0 0 24px 0;">\n    {{rows_html}}\n  </ul>\n  <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#666666;margin:0 0 24px 0;">{{overflow_count}}</p>\n  <hr style="border:none;border-top:1px solid #e8e8e8;margin:24px 0;">\n  <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#999999;margin:0;">Sent each morning at 5am MST from GAT-BOS. Open the dashboard to act on any item.</p>\n</div>\n</body>\n</html>',
    E'{{date}}\n\nHere is what is due this week\n\n{{count_total}} touchpoints and tasks are due this week or overdue. The list below is sorted by due date.\n\n{{rows_text}}\n\n{{overflow_count}}\n\n---\nSent each morning at 5am MST from GAT-BOS. Open the dashboard to act on any item.'
  )
ON CONFLICT (slug, version) DO UPDATE
SET
  name      = EXCLUDED.name,
  send_mode = EXCLUDED.send_mode,
  kind      = EXCLUDED.kind,
  subject   = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  updated_at = now();
