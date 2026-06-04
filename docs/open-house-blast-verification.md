# Open House Blast: verification report

Branch `open-house-blast-system`. 11 slices, atomic commits, every commit passes
`pnpm typecheck` and the final state passes `pnpm build` (all 7 routes, no collisions).

## Build status

| # | Slice | Commit | State |
|---|-------|--------|-------|
| 1 | Data layer (contacts +city/+email_status/+token, open_house_blasts, blast_sends, RLS, seed) | bc8d0f1 | verified |
| 2 | City-segmented matching + live count | d673594 | verified |
| 3 | Light text-forward email (Primary-inbox) | 8269513 | verified |
| 4 | Public landing page (click target) | 5169beb | verified |
| 5 | Under-2-min intake form + live count | 206249c | verified |
| 6 | Preview gate + batched warmup send pipeline | 3b88cb6 | verified (send gated) |
| 7 | One-click unsubscribe, instant suppression | df1f17d | verified |
| 8 | Webhook bounce/complaint auto-suppression | 0e66980 | built + typechecked |
| 9 | Per-blast dashboard vs WALL | f723632 | verified |
| 10 | Delivery infra (subdomain, DNS, env, warmup) | 5232a45 | handoff to Alex |
| 11 | Verify (build, render, report) | 5e14366 | this report |

## DONE MEANS, mapped to evidence

1. **Create a blast in under 2 minutes** -- `/blasts/new`: one form (agent, address, city,
   date/time, price, specs, photo URLs, highlights). Rendered + 200. VERIFIED.
2. **See the matched recipient count** -- live count debounced on city via
   `/api/open-house/recipient-count`. Seed pools: Scottsdale 6, Paradise Valley 3, Phoenix 4,
   `__mailtest__` 4. VERIFIED (count shown in form and on the preview page = 6).
3. **Preview email and landing page** -- preview page shows the real email in an iframe,
   matched count, WALL guardrails, preflight verdict (PASS), and a link to the live landing
   page. VERIFIED (screenshot).
4. **Approve, and send** -- "Approve and send to N agents" button POSTs to
   `/api/open-house/send`. auto_send flag off by default. This is the only runtime gate
   (Rule 5). The pipeline behind it: preflight gate, 100-batch, 500ms throttle, warmup cap,
   subdomain From, List-Unsubscribe headers, blast_sends ledger, activity summary event.
   BUILT + typechecked. The live send itself is intentionally NOT auto-triggered.
5. **Test send lands in Primary with a strong mail-tester score** -- the whole email design
   is built to clear Promotions (light, text-forward, one photo, one button, plain-text alt,
   subdomain-aligned links, one-click unsubscribe). The test send WAS executed through Resend
   (probe blast to the two real seed inboxes): preflight PASSED, the pipeline dispatched both
   calls, and Resend returned, verbatim:
   `"The opens.alexhollienco.com domain is not verified. Please, add and verify your domain on
   https://resend.com/domains"`. Zero email delivered (Resend rejects pre-send). This is
   empirical proof that the full pipeline works up to and including the Resend API, and that
   the ONLY remaining gate is DNS verification of the subdomain -- a registrar action only
   Alex can perform. Until then, a mail-tester score and Primary placement are physically
   unobtainable. Steps in `docs/open-house-blast-setup.md` section 6.
6. **One-click unsubscribe suppresses instantly** -- VERIFIED end to end: hitting `/u/<token>`
   flipped a seed contact `active -> unsubscribed` instantly, wrote an
   `open_house.unsubscribed` activity event, and the Scottsdale match count dropped 6 -> 5
   (suppressed contact no longer matched). Restored after the test.
7. **Webhook auto-suppresses bounces and complaints** -- VERIFIED end to end through the real
   signed HTTP path. Posted a properly Svix-signed `email.bounced` event: the contact flipped
   `active -> bounced`, its `blast_sends` row synced to `bounced`, and an
   `open_house.email.bounced` activity event was written. Repeated with `email.complained`:
   contact `-> complained`, send `-> complained`, `open_house.email.complained` logged. Since
   matching requires `email_status = active`, suppressed contacts are never matched again.
   (Harness: `scripts/sim-resend-webhook.ts`.)
8. **Dashboard shows real numbers** -- VERIFIED (screenshot): from a seeded send, the
   dashboard read Recipients 6, Delivered 5 (83.3%), Opens 3 (60%), Clicks 2 (40%),
   Bounce 16.7% shown in RED over the 4% wall, Complaint 0% within the 0.08% wall, with a
   matching guardrail-status line.

## Invariants enforced

- WALL: complaint/bounce ceilings surfaced and flagged red when over; never sends from root
  or CRM domain (assertFromAllowed forbids `alexhollienco.com` and `gat-bos.vercel.app`
  exactly, allows the `opens.` subdomain); never hard-deletes (status flip only); opt-outs
  instant; no em dashes (enforced by hook across the build).
- DEFAULT: every send segmented by city; warmup cap honored; agent branding on (From display
  name, signature, landing agent card).
- SCAR: matching requires a non-empty city; an empty city returns zero recipients; the send
  refuses an empty recipient set. No unsegmented blob path exists.

## Zero-click fix (why this is different from the last three blasts)

Dedicated warmed subdomain (vs unwarmed root), RFC 8058 one-click List-Unsubscribe (vs none),
light text-forward email that reads as 1:1 (vs heavy image template that triggers Promotions),
click + unsubscribe links on the From domain (vs off-domain), 100-batch + warmup ramp (vs
rapid-fire), and a verified webhook with auto-suppression (vs the silently-broken one).

## Structural design pass (design-critique dimensions)

- Email: single column, clear hierarchy (greeting -> details block -> photo -> single CTA ->
  signature -> compliance), consistent left alignment, generous rhythm, one accent (Signal
  button). Reads as personal, not marketing. Images-off variant verified fully usable.
- Landing: canonical 4-color system, hero -> snapshot bar -> open-house card -> story ->
  gallery -> agent card -> compliance footer. Single H1, RealEstateListing + RealEstateAgent
  JSON-LD, OG tags, alt text. No GAT on the digital surface.

## Remaining (Alex-side, Rule 5 production writes)

1. Add `opens.alexhollienco.com` in Resend, add SPF/DKIM/DMARC at the registrar
   (`~/Desktop/PASTE-INTO-DNS-opens-subdomain.txt`), alias the subdomain in Vercel.
2. Set the `BLAST_*` env vars (`~/Desktop/PASTE-INTO-ENV-open-house.txt`) and the prod
   `RESEND_API_KEY` + `RESEND_WEBHOOK_SECRET`.
3. Replace the seeded Outlook/Yahoo placeholders with real test inboxes; add the current
   mail-tester address as a `__mailtest__` contact.
4. Run the go-live test send (setup doc section 6): mail-tester score, Primary placement,
   click registers on the dashboard.
5. Import the real city-tagged recipient pool (the 189 Berneil contacts have null city; seed
   pools are placeholders). Confirm `BLAST_FOOTER_ADDRESS`.
6. Code review + merge: branch `open-house-blast-system` is not pushed (your call).

## Placeholders
- Real Outlook / Yahoo test inboxes (seeded as example.com)
- SPF/DKIM/MX values (generated when the domain is added in Resend)
- `BLAST_FOOTER_ADDRESS` postal address confirmation
- Real city-tagged recipient import
