INSERT INTO public.templates (
  name,
  slug,
  send_mode,
  subject,
  body_html,
  body_text,
  kind,
  version
) VALUES (
  'The Weekly Edge -- Issue #{{ issue_number }}',
  'weekly-edge',
  'both',
  'The Weekly Edge -- Issue #{{ issue_number }} -- {{ issue_date_long }}',
$body_html$<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>The Weekly Edge -- Issue #{{ issue_number }} -- {{ issue_date_long }}</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Playfair+Display:ital,wght@1,400&family=Inter:wght@300;400;500;600;700&family=Space+Mono&display=swap" rel="stylesheet">
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
    body { margin: 0; padding: 0; width: 100%; }
    @media only screen and (max-width: 640px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .section-padding { padding-left: 24px !important; padding-right: 24px !important; }
      .masthead-title { font-size: 48px !important; line-height: 1.05 !important; }
      .listing-grid-cell { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
      .listing-card-table { width: 100% !important; margin-bottom: 16px !important; }
      .cta-headline { font-size: 22px !important; }
      .opener-body { font-size: 16px !important; }
      .mobile-hide { display: none !important; }
      .footer-stack { display: block !important; width: 100% !important; text-align: center !important; }
      .footer-right { text-align: center !important; padding-top: 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #18181b; font-family: 'Inter', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #18181b;">
    <tr><td align="center" style="padding: 0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="640" class="email-container" style="max-width: 640px; width: 100%; margin: 0 auto;">
        <tr><td style="background-color: #09090b; background-image: repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 6px); padding: 44px 48px 36px 48px;" class="section-padding">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="font-family: 'Inter', Arial, sans-serif; font-size: 11px; font-weight: 600; color: #e63550; letter-spacing: 0.12em; text-transform: uppercase; padding-bottom: 24px;">GREAT AMERICAN TITLE AGENCY &nbsp;&middot;&nbsp; PHOENIX VALLEY</td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr><td style="font-family: 'Syne', Arial, sans-serif; font-size: 64px; font-weight: 700; color: #f4f4f5; line-height: 1.05; padding-bottom: 4px;" class="masthead-title">The Weekly</td></tr>
            <tr><td style="font-family: 'Syne', Arial, sans-serif; font-size: 64px; font-weight: 700; line-height: 1.05; padding-bottom: 20px;" class="masthead-title"><span style="color: #e63550;">Edge</span><span style="display: inline-block; width: 6px; height: 6px; background-color: #e63550; border-radius: 50%; margin-left: 4px; vertical-align: middle;"></span></td></tr>
          </table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="height: 1px; background: linear-gradient(to right, #e63550, transparent); padding: 0; line-height: 1px; font-size: 1px;">&nbsp;</td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
            <td style="padding-top: 16px; font-family: 'Space Mono', 'Courier New', monospace; font-size: 12px; font-weight: 400; color: #71717a; line-height: 1.5;">Vol. 1 &nbsp;&middot;&nbsp; {{ issue_date_metadata }} &nbsp;&middot;&nbsp; Phoenix Valley Market</td>
            <td style="padding-top: 16px; font-family: 'Space Mono', 'Courier New', monospace; font-size: 12px; font-weight: 400; color: #71717a; line-height: 1.5; text-align: right;">Issue #{{ issue_number }}</td>
          </tr></table>
        </td></tr>
        <tr><td style="background-color: #f4f4f5; padding: 44px 48px;" class="section-padding">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="font-family: 'Inter', Arial, sans-serif; font-size: 11px; font-weight: 600; color: #a1a1aa; letter-spacing: 0.12em; text-transform: uppercase; padding-bottom: 12px;">FROM ALEX'S DESK</td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="width: 44px; height: 3px; background-color: #e63550; line-height: 3px; font-size: 1px;">&nbsp;</td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="padding-top: 24px; font-family: 'Playfair Display', Georgia, serif; font-size: 17px; font-weight: 400; font-style: italic; color: #09090b; line-height: 1.85;" class="opener-body">{{ opener_html }}</td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="padding-top: 28px;"><span style="font-family: 'Inter', Arial, sans-serif; font-size: 12px; font-weight: 500; font-style: italic; color: #09090b;">-- Alex Hollien</span><br><span style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 400; color: #a1a1aa;">Title Sales Executive, Great American Title Agency</span></td></tr></table>
        </td></tr>
        <tr><td style="background-color: #131316; padding: 44px 48px;" class="section-padding">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td><span style="font-family: 'Inter', Arial, sans-serif; font-size: 11px; font-weight: 600; color: #e63550; letter-spacing: 0.12em; text-transform: uppercase;">WEEKLY DATA</span><br><span style="font-family: 'Syne', Arial, sans-serif; font-size: 24px; font-weight: 700; color: #f4f4f5; line-height: 1.3;">GAT Market Stats</span></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="padding-top: 24px;">{{ stats_image_html }}</td></tr></table>
        </td></tr>
        <tr><td style="background-color: #f4f4f5; padding: 44px 48px;" class="section-padding">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td><span style="font-family: 'Inter', Arial, sans-serif; font-size: 11px; font-weight: 600; color: #2563eb; letter-spacing: 0.12em; text-transform: uppercase;">WEEKEND PREVIEW</span><br><span style="font-family: 'Syne', Arial, sans-serif; font-size: 24px; font-weight: 700; color: #09090b; line-height: 1.3;">The Weekender</span></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="padding-top: 24px;">{{ weekender_image_html }}</td></tr></table>
        </td></tr>
        <tr><td style="background-color: #09090b; background-image: repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 8px); border-left: 3px solid #e63550; padding: 44px 48px 44px 45px;" class="section-padding">{{ featured_section_html }}</td></tr>
        <tr><td style="background-color: #f4f4f5; padding: 44px 48px;" class="section-padding">{{ listings_section_html }}</td></tr>
        <tr><td style="background-color: #ffffff; padding: 52px 48px; text-align: center;" class="section-padding">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td align="center" style="font-family: 'Inter', Arial, sans-serif; font-size: 11px; font-weight: 600; color: #a1a1aa; letter-spacing: 0.12em; text-transform: uppercase; padding-bottom: 12px;">LET'S CONNECT</td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td align="center" style="padding-bottom: 12px;"><span style="font-family: 'Syne', Arial, sans-serif; font-size: 28px; font-weight: 700; color: #09090b; line-height: 1.2; display: inline-block; max-width: 380px;" class="cta-headline">Have an idea or a deal in motion?</span></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td align="center" style="padding-bottom: 28px;"><span style="font-family: 'Inter', Arial, sans-serif; font-size: 13px; font-weight: 400; color: #71717a; line-height: 1.6; display: inline-block; max-width: 320px;">One text gets the conversation started. I respond the same day -- usually within the hour.</span></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td align="center" style="border-radius: 8px; background-color: #09090b;"><a href="sms:+14802042983?body=Hey%20Alex%2C%20I%20have%20an%20idea%20I%27d%20like%20to%20get%20started." target="_blank" style="display: inline-block; padding: 18px 44px; font-family: 'Inter', Arial, sans-serif; font-size: 12px; font-weight: 700; color: #ffffff; text-decoration: none; text-transform: uppercase; letter-spacing: 0.05em;">Text Alex Now</a></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td align="center" style="padding-top: 12px; font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 400; color: #a1a1aa;">Opens pre-written text &middot; Works on any smartphone</td></tr></table>
        </td></tr>
        <tr><td style="background-color: #09090b; padding: 36px 48px 28px 48px;" class="section-padding">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="height: 1px; background-color: rgba(255,255,255,0.06); line-height: 1px; font-size: 1px; padding-bottom: 0;">&nbsp;</td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
            <td width="50%" valign="top" class="footer-stack" style="padding-top: 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                <td style="width: 52px; height: 52px; vertical-align: middle; padding-right: 12px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="width: 52px; height: 52px; border-radius: 50%; border: 2px solid #e63550; background-color: #131316; text-align: center; vertical-align: middle; font-family: 'Syne', Arial, sans-serif; font-size: 18px; font-weight: 700; color: #f4f4f5;">AH</td></tr></table></td>
                <td style="vertical-align: middle;"><span style="font-family: 'Syne', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff;">Alex Hollien</span><br><span style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 400; color: #71717a;">Title Sales Executive</span></td>
              </tr></table>
            </td>
            <td width="50%" valign="top" class="footer-stack footer-right" style="padding-top: 24px; text-align: right;"><span style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 700; color: #e63550; letter-spacing: 0.08em; text-transform: uppercase;">GREAT AMERICAN</span><br><span style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 700; color: #52525b; letter-spacing: 0.08em; text-transform: uppercase;">TITLE AGENCY</span><br><span style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 400; color: #3f3f46;">Phoenix Valley</span></td>
          </tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="padding-top: 20px; padding-bottom: 16px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="height: 1px; background-color: rgba(255,255,255,0.06); line-height: 1px; font-size: 1px;">&nbsp;</td></tr></table></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
            <td style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 400; color: #71717a;"><a href="tel:+14802042983" style="color: #71717a; text-decoration: none;">(480) 204-2983</a> &nbsp;&middot;&nbsp; <a href="mailto:alex.hollien@gaTitle.com" style="color: #71717a; text-decoration: none;">alex.hollien@gaTitle.com</a></td>
            <td style="text-align: right; font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 400;"><a href="%%unsubscribe%%" style="color: #71717a; text-decoration: underline;">Unsubscribe</a></td>
          </tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="padding-top: 16px; font-family: 'Inter', Arial, sans-serif; font-size: 9px; font-weight: 400; color: #3f3f46; line-height: 1.5;">Great American Title Agency &middot; 14850 N Scottsdale Rd, Suite 160, Scottsdale, AZ 85254<br>You are receiving this email because you opted in to The Weekly Edge. &copy; 2026 Great American Title Agency. All rights reserved.</td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$body_html$,
$body_text$The Weekly Edge -- Issue #{{ issue_number }} -- {{ issue_date_long }}
GREAT AMERICAN TITLE AGENCY -- PHOENIX VALLEY
Vol. 1 -- {{ issue_date_metadata }} -- Phoenix Valley Market

FROM ALEX'S DESK
{{ opener_html }}

-- Alex Hollien
Title Sales Executive, Great American Title Agency

WEEKLY DATA -- GAT MARKET STATS
{{ stats_image_html }}

WEEKEND PREVIEW -- THE WEEKENDER
{{ weekender_image_html }}

FEATURED THIS WEEK
{{ featured_section_html }}

NEW LISTINGS THIS WEEK
{{ listings_section_html }}

LET'S CONNECT
Have an idea or a deal in motion? One text gets the conversation started.
sms:+14802042983

(480) 204-2983 -- alex.hollien@gaTitle.com
Great American Title Agency -- 14850 N Scottsdale Rd, Suite 160, Scottsdale, AZ 85254
(c) 2026 Great American Title Agency. All rights reserved.$body_text$,
  'newsletter',
  1
)
ON CONFLICT (slug, version) DO NOTHING;