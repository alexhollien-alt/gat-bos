# Open House Blast: what to do next

Status: **LIVE in production, verified end-to-end** (mail-tester 9/10, delivered, click registered).
This is your action list, ordered by priority.

---

## 1. Do now (about 5 minutes)

- [ ] **Eyeball the Primary tab.** Open `yourcoll2347@gmail.com`, find "Sunday open house in Scottsdale"
      (from opens@opens.alexhollienco.com). Confirm it is in the **Primary** tab, not Promotions.
      This is the one thing I could not see from here. Every technical signal says Primary
      (9/10, SPF+DKIM pass, light text), so this is a confirmation glance.
- [ ] **Merge PR #66** (`open-house-blast-system -> main`). Production is already serving this
      branch (deployed via `vercel promote`), so this just makes `main` match what is live.
      `gh pr merge 66 --squash --delete-branch` when you are ready.

---

## 2. Before your FIRST real blast (the one real blocker)

- [ ] **Import real city-tagged agents.** Right now NO real agent has a city tag. The 189 Berneil
      contacts have `city = null` (the import stripped it), and the only city-tagged contacts are
      test seeds. The feature matches recipients by `contacts.city`, so until your real agent pool
      has cities, a real blast matches nobody.
      - Backfill `contacts.city` for your existing agents, OR import your agent list with a `city`
        column. Set `email_status = 'active'` (default) and `type = 'realtor'`.
      - Sanity check: `/blasts/new`, type a city, the live count should show your real agents.

- [ ] **Enable Resend open + click tracking** on `opens.alexhollienco.com`.
      Resend -> Domains -> opens.alexhollienco.com -> Tracking -> turn ON "Open tracking" and
      "Click tracking." It is currently OFF, which is why the verification click had to be injected
      through the webhook. With it ON, real opens/clicks from recipients auto-populate the dashboard.

- [ ] **Pick warmup caps for the first sends.** A cold subdomain should ramp, not blast 300 at once.
      Set `daily_send_cap` on the first blasts: 50, then 100, then 250, then double daily. The sender
      already enforces the cap (over-cap recipients queue for the next run) and batches in 100s.

---

## 3. Polish (after about a week of warmup)

- [ ] **Tighten DMARC** from `p=none` to `p=quarantine` (then `p=reject`) once SPF+DKIM are clean in
      your DMARC reports. That recovers the last mail-tester point (9 -> 10).
      Record: `_dmarc.opens.alexhollienco.com  TXT  v=DMARC1; p=quarantine; rua=mailto:dmarc@alexhollienco.com; fo=1`
- [ ] **Confirm the footer postal address** (`BLAST_FOOTER_ADDRESS`) is your correct CAN-SPAM address.
- [ ] (Optional) Add real Outlook / Yahoo test inboxes if you want to verify those clients too.

---

## 4. How to actually run a blast (the 2-minute workflow)

1. Go to `gat-bos.vercel.app/blasts/new`.
2. Pick the hosting agent, type the address + **city** (drives the match), date/time, price, 1-2
   photo URLs, a line of highlights.
3. Watch the live recipient count for that city.
4. Click "Build preview" -> review the email + the landing page + the recipient count + preflight.
5. Click "Approve and send." (Auto-send flag is off by default.)
6. Watch the dashboard at `/blasts/[id]`: delivered, opens, clicks, bounce%, complaint% vs the WALL.

---

## Reference

- Live landing example: `https://gat-bos.vercel.app/open-house/mailtest-live-probe`
- Verification report: `docs/open-house-blast-verification.md`
- Delivery/DNS setup: `docs/open-house-blast-setup.md`
- Prod test artifacts (harmless): blast `f9b7aeb5...`, 3 `__mailtest__` contacts (reverted from
  Scottsdale so they never match a real send). Soft-delete them anytime.
- Resend key was opened to all domains (was root-scoped) -- that was the final unlock.

Remaining placeholders: real city-tagged agent import; real Outlook/Yahoo test inboxes; confirm
BLAST_FOOTER_ADDRESS.
