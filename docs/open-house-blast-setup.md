# Open House Blast: delivery setup (go-live checklist)

The code is built and verified. These steps are the production handoff: they touch
DNS, the Resend account, and Vercel, so they are yours to run (Rule 5 production writes).
Nothing sends until you complete them and flip the preview Approve button.

## 1. Add the sending subdomain in Resend

Use a DEDICATED subdomain, separate from the root and the CRM:

- Sending domain: `opens.alexhollienco.com`
- Never `alexhollienco.com` (root) or `gat-bos.vercel.app` (CRM). The code enforces
  this (WALL guard in `resend-blast.ts`).

In the Resend dashboard: Domains -> Add Domain -> `opens.alexhollienco.com`. Resend then
shows the exact DNS records to add (SPF/Return-Path MX + DKIM). Copy them into the
PASTE-INTO-DNS file fields marked `[FROM RESEND]`.

## 2. Add the DNS records at your registrar

See `~/Desktop/PASTE-INTO-DNS-opens-subdomain.txt`. Three groups:

1. SPF + Return-Path (MX/TXT) -- provided by Resend on domain creation.
2. DKIM (CNAME or TXT) -- provided by Resend on domain creation.
3. DMARC (TXT) -- provided in full below; start at `p=none` for monitoring.

DMARC (you can add this one now, exact value):

```
Host:  _dmarc.opens.alexhollienco.com
Type:  TXT
Value: v=DMARC1; p=none; rua=mailto:dmarc@alexhollienco.com; fo=1
```

Keep `p=none` for the first week of warmup, then move to `p=quarantine` once SPF+DKIM
pass cleanly in the DMARC aggregate reports.

## 3. Point the subdomain at the app (so links align with the From domain)

The email button and the unsubscribe link both live on `opens.alexhollienco.com`. Add it
as a domain alias of the CRM app in Vercel so those routes resolve:

```
vercel domains add opens.alexhollienco.com
# then alias it to the CRM production deployment / project
```

`/open-house/[slug]` and `/u/[token]` then serve from the subdomain, aligned with the
From domain. (They already work on the CRM host as a fallback via `BLAST_PUBLIC_BASE_URL`.)

## 4. Set environment variables

Add the `BLAST_*` vars (see `~/Desktop/PASTE-INTO-ENV-open-house.txt`) to `.env.local`
and to Vercel (`vercel env add`). Defaults in `config.ts` already point at the subdomain,
so prod works once DNS verifies; the env vars make it explicit and overridable.

## 5. Warm the subdomain gradually

A cold subdomain sending 300 at once looks like spam. Ramp volume:

| Day | Max sends | How |
|-----|-----------|-----|
| 1 | 50 | set `daily_send_cap = 50` on the blast row |
| 2 | 100 | `daily_send_cap = 100` |
| 3 | 250 | ... |
| 4+ | double daily until full volume |

The sender enforces `daily_send_cap`: recipients beyond the cap are recorded as `queued`
and mailed on the next run. `WARMUP_RAMP` in `config.ts` is the suggested ramp. Batches
of 100 with a 500ms throttle are always applied.

## 6. Go-live verification (the zero-click fix proof)

1. Create a blast for city `__mailtest__` (routes to your controlled seed inboxes).
2. Add the current mail-tester.com address as a contact in city `__mailtest__`, plus your
   real Gmail / Outlook / Yahoo test inboxes (replace the seeded placeholders).
3. With DNS verified and the prod `RESEND_API_KEY` set, open the preview and Approve.
4. Confirm: mail-tester score (target 9+/10), the message lands in Gmail Primary (not
   Promotions), and the email is readable with images off.
5. Click the button in the delivered email, then open the blast dashboard and confirm the
   click registered (`clicked` count increments via the webhook).
6. Click "Unsubscribe instantly" in one inbox and confirm the contact flips to
   `unsubscribed` immediately and drops from the next recipient count.

## Why this fixes the zero-click problem

| Past failure | This build |
|---|---|
| Sent from unwarmed root domain | Dedicated warmed subdomain, ramped caps |
| No List-Unsubscribe (RFC 8058) | One-click List-Unsubscribe + List-Unsubscribe-Post on every send |
| Heavy image-forward template = Promotions | Light, text-forward, one photo, one button, plain-text alt |
| Click links off-domain | Landing + unsubscribe on the sending subdomain |
| Rapid-fire, no batching | 100-batch, throttle, warmup cap |
| Webhook silently broken | Verified webhook + bounce/complaint auto-suppression |

Remaining placeholders:
- `[FROM RESEND]` SPF/DKIM/MX values (generated when you add the domain in Resend)
- Real Outlook / Yahoo test inbox addresses (replace seeded placeholders)
- Confirm `BLAST_FOOTER_ADDRESS` postal address
