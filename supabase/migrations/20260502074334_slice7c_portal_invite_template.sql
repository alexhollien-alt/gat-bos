-- Slice 7C / Task 5b -- Portal invite email template seed.
--
-- Resolved by /api/portal/invite (Task 5a) via sendMessage({ templateSlug:
-- 'portal-invite' }). The route hands these variables to the renderer:
--   {{agent_first_name}}  -- contact.first_name (may be empty)
--   {{agent_slug}}        -- contact.slug (URL-safe agent slug)
--   {{redeem_url}}        -- one-time magic-link URL hitting /portal/redeem
--   {{portal_url}}        -- /portal/<slug>/dashboard landing target
--   {{expires_at_human}}  -- e.g. "Saturday, May 9" (America/Phoenix)
--   {{expires_at_iso}}    -- ISO timestamp, surfaced as machine-readable copy
--
-- send_mode = 'gmail' so the invite arrives as a personal note from Alex
-- (matches the new-agent-onboarding pattern). kind = 'transactional' because
-- delivery is event-triggered by an explicit owner action, not a campaign.
--
-- Kit 1 fonts (Instrument Serif + Inter) inlined for email-client compat.
-- Brand voice: warm/specific. No banned words, no exclamations, no em dashes
-- (double-hyphen `--` per Rule 2). No GAT co-brand inside body (Rule 8).
--
-- Idempotency: ON CONFLICT (slug, version) DO UPDATE so re-runs reseed copy
-- without producing duplicate rows. No explicit BEGIN/COMMIT (Supabase CLI
-- auto-wraps each migration; explicit transaction triggers replay error per
-- 7A.5 fix in 20260427240000_slice5b_daily_summary_template.sql).
--
-- user_id is the Alex owner UUID locked by 7A.5 mirror
-- (20260429001634_slice7a_templates_user_id_from_prod_mirror.sql). The
-- column DEFAULTs to auth.uid(), but CLI push runs as service_role with no
-- JWT so auth.uid() returns NULL and the NOT NULL check fails. Pass the
-- literal explicitly to match the same backfill value used for slice5b.

INSERT INTO public.templates (user_id, slug, version, name, send_mode, kind, subject, body_html, body_text)
VALUES
  (
    'b735d691-4d86-4e31-9fd3-c2257822dca3'::uuid,
    'portal-invite',
    1,
    'Portal Invite -- Magic Link',
    'gmail',
    'transactional',
    E'Your GAT-BOS portal access',
    E'<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>Your GAT-BOS portal access</title>\n</head>\n<body style="margin:0;padding:0;background:#f7f7f5;font-family:Inter,Helvetica,Arial,sans-serif;color:#0a0a0a;">\n<div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;">\n  <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#666666;margin:0 0 8px 0;">GAT-BOS Portal</p>\n  <h1 style="font-family:\'Instrument Serif\',Georgia,serif;font-size:32px;line-height:1.2;color:#0a0a0a;margin:0 0 24px 0;font-weight:400;">Hey {{agent_first_name}}, your portal is ready</h1>\n  <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#0a0a0a;margin:0 0 20px 0;">I set up a private workspace for you inside GAT-BOS. It is where you can request marketing pieces, see your upcoming events, and review the messages I have sent on your behalf.</p>\n  <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#0a0a0a;margin:0 0 28px 0;">Use the button below to sign in. The link is single-use and expires {{expires_at_human}}.</p>\n  <p style="margin:0 0 28px 0;">\n    <a href="{{redeem_url}}" style="display:inline-block;background:#0a0a0a;color:#ffffff;font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;font-weight:500;letter-spacing:0.04em;text-decoration:none;padding:14px 28px;border-radius:4px;">Open My Portal</a>\n  </p>\n  <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#666666;margin:0 0 12px 0;">If the button does not render, paste this URL into your browser:</p>\n  <p style="font-family:\'Space Mono\',Menlo,Consolas,monospace;font-size:12px;line-height:1.5;color:#0a0a0a;word-break:break-all;margin:0 0 28px 0;">{{redeem_url}}</p>\n  <hr style="border:none;border-top:1px solid #e8e8e8;margin:24px 0;">\n  <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.55;color:#666666;margin:0 0 8px 0;">Once you are signed in, your dashboard lives at:</p>\n  <p style="font-family:\'Space Mono\',Menlo,Consolas,monospace;font-size:12px;line-height:1.5;color:#0a0a0a;word-break:break-all;margin:0 0 24px 0;">{{portal_url}}</p>\n  <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.55;color:#666666;margin:0 0 24px 0;">Did not expect this? You can ignore the email and the link will quietly expire. Reply to this thread if anything looks off and I will sort it out.</p>\n  <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.55;color:#999999;margin:0;">-- Alex</p>\n</div>\n</body>\n</html>',
    E'Hey {{agent_first_name}}, your portal is ready.\n\nI set up a private workspace for you inside GAT-BOS. It is where you can request marketing pieces, see your upcoming events, and review the messages I have sent on your behalf.\n\nUse the link below to sign in. The link is single-use and expires {{expires_at_human}}.\n\n{{redeem_url}}\n\nOnce you are signed in, your dashboard lives at:\n{{portal_url}}\n\nDid not expect this? You can ignore the email and the link will quietly expire. Reply to this thread if anything looks off and I will sort it out.\n\n-- Alex'
  )
ON CONFLICT (slug, version) DO UPDATE
SET
  name       = EXCLUDED.name,
  send_mode  = EXCLUDED.send_mode,
  kind       = EXCLUDED.kind,
  subject    = EXCLUDED.subject,
  body_html  = EXCLUDED.body_html,
  body_text  = EXCLUDED.body_text,
  updated_at = now();
