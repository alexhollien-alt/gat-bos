# Open House Blast -- Session Handoff (2026-06-04)

Read this first. It is the single source of truth for where the open house blast feature stands,
the full story of how it got here, and exactly what is left. Pairs with:
- `docs/open-house-blast-verification.md` (proof the live send works)
- `docs/open-house-blast-setup.md` (DNS / Resend / warmup)
- `docs/open-house-blast-NEXT-STEPS.md` (the earlier checklist; partly superseded by the pivot below)
- `~/.claude/plans/open-house-blast-system.md` (the build plan)

---

## TL;DR

The feature is **BUILT, LIVE in production, and verified end-to-end** (mail-tester 9/10, delivered,
click registered). Then we **pivoted the recipient architecture**: blast recipients must NOT live in
`contacts` (your relationship CRM). The next work is the **option-B refactor** (separate
`blast_recipients` table). After that, load per-city agent lists and you are blasting for real.

---

## The full story (start to finish)

1. **Built the whole system** on branch `open-house-blast-system` (12 commits, merged via **PR #66**):
   intake form, city matching, a deliberately light/text-forward Primary-inbox email, a per-listing
   public landing page, a preview gate, a batched + warmup + preflight-gated Resend sender on the
   dedicated subdomain `opens.alexhollienco.com` with List-Unsubscribe headers, one-click
   unsubscribe, a webhook that auto-suppresses bounces/complaints, and a per-blast dashboard.
   typecheck + build green throughout.
2. **The live send was blocked twice** and you cleared both: first the subdomain DNS / Resend domain
   verification, then the Resend API key being **scoped to the root domain** (you opened it to all
   domains -- that was the final unlock).
3. **Live test passed:** sent from `opens@opens.alexhollienco.com` to a mail-tester address + your
   seed inboxes -> **mail-tester 9/10** ("you can send", SpamAssassin clean; only deduction is DMARC
   `p=none`, the intentional warmup setting), **delivered**, and a **button click registered in the
   dashboard** (Clicks: 1). Deployed to prod `gat-bos.vercel.app` (via `vercel promote`), prod
   Supabase migrated.
4. **Shipped warmup default:** every new blast caps at **`daily_send_cap = 50`** (migration
   `20260604204149`, branch `open-house-warmup-cap`, pushed, **PR not yet opened/merged**).
5. **Direction pivot (the important part):** we realized **recipients are not contacts**. Your
   `contacts` table is your relationship CRM (your ~95-120 client realtors you market FOR). The blast
   recipients are *other* agents you cold-invite on a client's behalf -- different people entirely.
   Putting cold per-city MLS pulls into `contacts` pollutes your health scores / dashboards. So we
   locked **option B**: recipients get their own table.
6. **Soft-deleted** the one-off Berneil luxury blast list from contacts (208 rows,
   `source = berneil-broker-open-2026-05-29-import`, recoverable via `deleted_at`).

---

## What is LIVE / DONE

- Feature live at `gat-bos.vercel.app`: `/blasts/new` (intake), `/open-house/[slug]` (landing),
  `/u/[token]` (unsubscribe), `/blasts/[id]` (dashboard). PR #66 merged to main.
- Live send verified: mail-tester 9/10, delivered, click registered, bounce/complaint 0%.
- Warmup cap 50 default applied to prod.
- Berneil 208 luxury contacts soft-deleted. Active realtors in contacts: ~95.

---

## The LOCKED direction -- what to BUILD next (option B)

Keep `contacts` pure (clients only). Give recipients their own home.

**Build tasks (all additive; live blast/dashboard/email/landing do NOT change):**

1. **`blast_recipients` table** (migration). Fields mirror what a send needs, separate from contacts:
   `id, account_id, user_id, first_name, last_name, email, brokerage, city, email_status
   ('active'|'unsubscribed'|'bounced'|'complained'|'manual_suppressed'), unsubscribe_token uuid,
   source, tags text[], created_at, updated_at, deleted_at`. Unique on
   `(account_id, city, lower(email))` (an agent can appear in more than one city). RLS = account-scoped
   like contacts. Index `(lower(city))` + `(email_status)` + unique `(unsubscribe_token)`.
2. **Rewire matching** in `src/lib/open-house/recipients.ts` (`getMatchedAudience`, `getSendRecipients`,
   `getRecipientCount`) to read from **`blast_recipients`** by city + `email_status='active'`, NOT from
   `contacts`. The intake live-count and preview then reflect the recipient pools.
3. **Host always gets a copy.** In `src/lib/open-house/sender.ts` `sendBlast`, auto-append the host
   (the blast's `agent_contact_id` -> contacts.email) to the recipient list every send, deduped, so the
   client sees the proof their open house went out. (You confirmed: every time.)
4. **Import tool.** A simple way to load a CSV per city (columns: First Name, Last Name, Email,
   Brokerage) into `blast_recipients` tagged with that city, deduped. Easiest first cut: a script
   (`scripts/import-recipients.ts <city> <csvPath>`); nicer later: an authed page
   `/blasts/recipients/import`. Start with the script.
5. **Suppression on the new table.** `src/lib/open-house/suppress.ts` (`suppressByToken`,
   `suppressByEmail`) and `/u/[token]` + the Resend webhook must flip `blast_recipients.email_status`
   (look up by token / email there). Decide: suppress in BOTH tables or just recipients (recipients is
   where blasts read from, so at minimum there).
6. **`docs/open-house-WHERE-THINGS-LIVE.md`** -- one page so nobody wonders again: clients ->
   `contacts`; recipient pools -> `blast_recipients`; campaigns -> `open_house_blasts`; send log ->
   `blast_sends`; suppression = the `email_status` column on the relevant table.
7. Apply migration to local + prod (`supabase db push`), deploy (`vercel promote` after build), verify.

---

## What ALEX does (manual, in parallel)

- [ ] **Resend dashboard:** Domains -> `opens.alexhollienco.com` -> Tracking -> turn ON **Open
      tracking + Click tracking**. (Currently OFF; that is why the test click had to be injected.)
- [ ] **Grab ~100 agents per city** from MLS for the top-12 cities below; hand over a CSV per city.
- [ ] **Open + merge the warmup-cap PR** (`open-house-warmup-cap`), or I will.
- [ ] After ~1 week of warmup: tighten DMARC `_dmarc.opens.alexhollienco.com` from `p=none` to
      `p=quarantine` (recovers the last mail-tester point).
- [ ] Confirm `BLAST_FOOTER_ADDRESS` is your correct CAN-SPAM postal address.

**Top 12 cities (priority order):** Scottsdale, Paradise Valley, Phoenix (split Arcadia/Biltmore/Central
if going deep), Gilbert, Chandler, Mesa, Tempe, Peoria, Glendale, Cave Creek/Carefree, Fountain Hills,
Queen Creek.

---

## Key facts / IDs / gotchas (do not relearn these)

- **Resend key** `re_RFMqL8MX...` is send-only and **now scoped to all domains** (was root-scoped --
  that was the multi-hour blocker). If a future key is created root-scoped, subdomain sends fail with a
  misleading "domain not verified".
- **Resend open/click tracking is OFF** until Alex enables it.
- `opens.alexhollienco.com` = the sending subdomain (email DNS only; no web alias). Email links +
  landing serve from `gat-bos.vercel.app`. DMARC `p=none` (warmup).
- **Prod owner identity:** `user_id = b735d691-4d86-4e31-9fd3-c2257822dca3`,
  `account_id = d2c8793f-f0b8-4b24-a47d-7b2387f8e7f0` (owner_user_id matches).
- **Prod test artifacts (harmless):** blast `f9b7aeb5-2ecb-4888-bca4-f034bbd1b660` + 3 `__mailtest__`
  contacts (mail-tester, yourcoll2347@gmail.com, ahollien@azgat.com). Soft-delete anytime.
- **Local dev:** local Supabase has test seeds; password `Testpass123!` set on
  `alex+local@example.com`; dev server runs on port 3001 (Rule 17: probe 3000/3001 first).
- **Parallel sessions share one git HEAD** in `~/crm` -- run `git branch --show-current` before any
  commit. This session is on branch `open-house-warmup-cap`. Pre-existing uncommitted WIP exists in the
  tree (sidebar.tsx, dashboard files, BUILD.md, LATER.md, berneil html) -- NOT ours; never `git add -A`,
  only add the specific files you change.
- **Supabase = CLI only** (Rule 23). **No em dashes** anywhere (Rule 2). **Soft delete only** (Rule 3).

---

## Key files

- Data: `supabase/migrations/20260604172018_open_house_blast_system.sql`,
  `supabase/migrations/20260604204149_open_house_default_send_cap.sql`
- Lib: `src/lib/open-house/{config,recipients,email,sender,suppress,queries,slug,format,resend-blast}.ts`
- Routes: `src/app/(app)/blasts/*`, `src/app/open-house/[slug]/page.tsx`, `src/app/u/[token]/route.ts`,
  `src/app/api/open-house/*`, `src/app/api/webhooks/resend/route.ts`
- Scripts (operational): `scripts/send-open-house-test.ts`, `scripts/seed-prod-mailtest.ts`,
  `scripts/sim-resend-webhook.ts`, `scripts/mailtester-score.ts`, `scripts/remove-berneil-luxury.ts`,
  `scripts/prod-contacts-geo.ts` (+ others in scripts/).

---

## Resume prompt (paste into a fresh session after /clear)

Build the option-B recipient refactor for the open house blast feature per
~/crm/docs/open-house-HANDOFF.md (section "what to BUILD next"): create blast_recipients, rewire
matching to read from it, auto-include the host as a recipient every send, add a CSV-per-city import
script, move suppression/unsubscribe/webhook onto blast_recipients, write WHERE-THINGS-LIVE.md, then
migrate + deploy + verify.
