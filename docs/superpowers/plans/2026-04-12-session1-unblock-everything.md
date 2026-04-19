# Session 1: Unblock Everything -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all blockers so Sessions 2-9 can run without friction -- GitHub remote, email feedback loop, MV security patch, and clean contact data.

**Architecture:** Four independent infrastructure tasks. No code changes to the CRM. Tasks 1-3 are ops steps; Task 4 is a data cleanup with SQL. Each task has its own verification so you know it landed.

**Tech Stack:** gh CLI (`~/.local/bin/gh`), Vercel Dashboard (UI), Supabase SQL Editor (UI), CRM contacts API

---

## Files Changed

No source files are created or modified in this session. All changes are:
- Git remote configuration (local git config only)
- Vercel environment variable (Vercel project settings)
- Supabase view security patch (SQL Editor -- manual paste)
- Contact data cleanup (SQL Editor -- manual paste)

---

## Task 1: GitHub -- Create Repo, Configure Remote, Push Branch

**Why first:** Every future session commit needs a remote. This is the safety net.

**Prereq:** You need to be authenticated with gh CLI. Run this in the terminal first:

```
! ~/.local/bin/gh auth login
```

Choose: GitHub.com > HTTPS > Login with a web browser. Complete the browser flow, then return here.

- [ ] **Step 1: Verify gh auth is working**

```bash
~/.local/bin/gh auth status
```

Expected output includes: `Logged in to github.com as <your-username>`

- [ ] **Step 2: Create the GitHub repo**

```bash
cd ~/crm && ~/.local/bin/gh repo create gat-bos --private --source=. --remote=origin --description="GAT-BOS CRM -- relationship intelligence engine for title sales"
```

Expected: outputs the new repo URL, e.g. `https://github.com/<username>/gat-bos`

If the repo name `gat-bos` is taken on your account, use `gat-bos-crm`.

- [ ] **Step 3: Verify remote is configured**

```bash
cd ~/crm && git remote -v
```

Expected:
```
origin  https://github.com/<username>/gat-bos.git (fetch)
origin  https://github.com/<username>/gat-bos.git (push)
```

- [ ] **Step 4: Push the current branch**

```bash
cd ~/crm && git push -u origin feat/spine-phase1
```

Expected: `Branch 'feat/spine-phase1' set up to track remote branch 'feat/spine-phase1' from 'origin'.`

- [ ] **Step 5: Verify push landed**

```bash
cd ~/crm && git log --oneline -3
```

Then confirm in the browser: `https://github.com/<username>/gat-bos/tree/feat/spine-phase1`

You should see the branch with commit `3c10d37` at the top.

- [ ] **Step 6: Commit this plan file**

```bash
cd ~/crm && git add docs/superpowers/plans/2026-04-12-session1-unblock-everything.md docs/superpowers/specs/2026-04-12-ultraplan-design.md && git commit -m "docs: add ultraplan spec and session 1 implementation plan" && git push
```

---

## Task 2: RESEND_WEBHOOK_SECRET -- Wire the Email Feedback Loop

**Why:** The webhook handler at `src/app/api/webhooks/resend/route.ts` is built and deployed but returns 401 on every Resend event because `RESEND_WEBHOOK_SECRET` is not set. Email opens and clicks are not flowing into `health_score`. This single env var closes the loop.

**The secret format:** Resend webhook secrets start with `whsec_` followed by a base64 string. The handler strips the prefix and decodes the remainder as the HMAC key. Do not strip it yourself -- paste the full `whsec_...` value.

### Step A: Get the secret from Resend

- [ ] **Step 1: Open Resend dashboard**

Go to `resend.com` > Log in > Webhooks (left sidebar).

- [ ] **Step 2: Find or create the webhook endpoint**

If a webhook already exists pointing to your Vercel deployment URL at `/api/webhooks/resend`, click into it and copy the signing secret. It will look like `whsec_abc123...`.

If no webhook exists yet:
- Click "Add Endpoint"
- URL: `https://<your-vercel-deployment>.vercel.app/api/webhooks/resend`
- Events to subscribe: `email.delivered`, `email.opened`, `email.clicked`
- Click "Create" and copy the signing secret shown

- [ ] **Step 3: Note the secret**

Keep it on your clipboard. You will paste it in the next step. Do not put it in any file.

### Step B: Add to Vercel

- [ ] **Step 4: Open Vercel project settings**

Go to `vercel.com` > your project (`gat-bos` or whatever the project is named) > Settings > Environment Variables.

- [ ] **Step 5: Add the env var**

- Key: `RESEND_WEBHOOK_SECRET`
- Value: paste the `whsec_...` string from Resend
- Environment: Production, Preview, Development (check all three)
- Click Save

- [ ] **Step 6: Add to local .env.local**

```bash
echo 'RESEND_WEBHOOK_SECRET=whsec_REPLACE_WITH_YOUR_SECRET' >> ~/crm/.env.local
```

Then open `~/crm/.env.local` and replace `whsec_REPLACE_WITH_YOUR_SECRET` with the actual value.

- [ ] **Step 7: Redeploy to pick up the new env var**

In Vercel dashboard: Deployments > most recent deployment > "..." menu > Redeploy.

Or if you have the Vercel CLI installed: `vercel --prod` from `~/crm`.

### Step C: Verify

- [ ] **Step 8: Test the webhook locally**

Start the dev server if not running:
```bash
cd ~/crm && pnpm dev
```

In a second terminal, simulate a Resend delivery event (replace `YOUR_SECRET` with the actual `whsec_...` value -- note this test uses a dummy signature so it will return 401, which confirms the handler is reading the secret correctly):

```bash
curl -X POST http://localhost:3000/api/webhooks/resend \
  -H "Content-Type: application/json" \
  -H "svix-id: test-id-001" \
  -H "svix-timestamp: $(date +%s)" \
  -H "svix-signature: v1,invalidsignature" \
  -d '{"type":"email.opened","data":{"to":["test@example.com"],"subject":"Test"}}'
```

Expected response: `{"error":"invalid signature"}` with HTTP 401.

This confirms the handler is running and reading `RESEND_WEBHOOK_SECRET`. A valid signed request from Resend will return `{"ok":true,...}`.

---

## Task 3: MV Lockdown SQL -- Secure the Health Score View

**Why:** `public.agent_relationship_health` (the materialized view) has default PUBLIC grants, meaning any authenticated Supabase user can read every contact's health scores directly via PostgREST. Today this is a single-user system so the blast radius is zero -- but it must be patched before any multi-user work. `dashboard-piece5-mv-lockdown.sql` revokes direct access and rebuilds the wrapper view with owner-level security + `auth.uid()` filtering.

**File location:** `~/crm/supabase/dashboard-piece5-mv-lockdown.sql`

- [ ] **Step 1: Open the SQL file and review it**

```bash
cat ~/crm/supabase/dashboard-piece5-mv-lockdown.sql
```

Read through it. It does four things:
1. REVOKEs SELECT on `agent_relationship_health` from anon, authenticated, PUBLIC
2. GRANTs SELECT to service_role only (for admin tooling)
3. Rebuilds `agent_health` wrapper view with `security_invoker = false` + `user_id = auth.uid()` filter
4. Re-grants SELECT on the wrapper to anon and authenticated

- [ ] **Step 2: Open Supabase SQL Editor**

Go to `supabase.com` > your project (`rndnxhvibbqqjrzapdxs`) > SQL Editor > New query.

- [ ] **Step 3: Paste and run the SQL**

Copy the full contents of `dashboard-piece5-mv-lockdown.sql` and paste into the editor. Click "Run".

Expected: `Success. No rows returned` (the `BEGIN/COMMIT` block runs cleanly).

- [ ] **Step 4: Run the verification queries**

In the same SQL Editor, run each of these in a new query tab:

**Query A -- wrapper still returns rows:**
```sql
SELECT count(*) FROM public.agent_health;
```
Expected: a positive number (your contacts).

**Query B -- direct MV access is now blocked:**
```sql
SELECT count(*) FROM public.agent_relationship_health;
```
Expected: `ERROR: permission denied for materialized view agent_relationship_health`

If Query B returns rows instead of an error, the REVOKE did not apply -- stop and investigate before continuing.

---

## Task 4: Clean Duplicate Contacts

**Why:** There are at least 2 Julie Jarmiolowski records (one with `tier=None/health_score=0`, one with `tier=A/health_score=62`). Duplicates corrupt health scoring, Today View counts, and campaign enrollment logic. Clean now before the signal scan starts writing signals against both records.

**Approach:** Query for duplicates via SQL Editor, identify the stale records by `tier=None` or `health_score=0`, then soft-delete (set `deleted_at`) rather than hard-delete.

### Step A: Audit for duplicates

- [ ] **Step 1: Find all duplicates by full name**

In Supabase SQL Editor, run:

```sql
SELECT
  first_name,
  last_name,
  COUNT(*) as count,
  array_agg(id ORDER BY created_at) as ids,
  array_agg(tier ORDER BY created_at) as tiers,
  array_agg(health_score ORDER BY created_at) as health_scores,
  array_agg(created_at ORDER BY created_at) as created_ats
FROM contacts
WHERE deleted_at IS NULL
GROUP BY first_name, last_name
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

Expected: at minimum one row for Julie Jarmiolowski. Note all IDs returned.

- [ ] **Step 2: Inspect each duplicate pair**

For each duplicate name returned, run:

```sql
SELECT id, first_name, last_name, email, tier, health_score, stage,
       brokerage, created_at, last_touch_date, interactions_count
FROM contacts
WHERE first_name = 'Julie' AND last_name = 'Jarmiolowski'
  AND deleted_at IS NULL
ORDER BY created_at;
```

Identify the canonical record: the one with `tier = 'A'`, higher `health_score`, more recent `last_touch_date`, or more complete fields. The other record is the stale duplicate.

Note the stale record's `id` (UUID).

### Step B: Soft-delete the stale duplicates

- [ ] **Step 3: Soft-delete the stale Julie record**

Replace `'STALE-UUID-HERE'` with the actual UUID of the stale record:

```sql
UPDATE contacts
SET deleted_at = NOW()
WHERE id = 'STALE-UUID-HERE'
  AND deleted_at IS NULL;
```

Expected: `1 row affected`.

- [ ] **Step 4: Repeat for any other duplicates found in Step 1**

For each additional duplicate pair, identify the stale record and run the same `UPDATE` with its UUID.

- [ ] **Step 5: Verify no duplicates remain**

```sql
SELECT first_name, last_name, COUNT(*) as count
FROM contacts
WHERE deleted_at IS NULL
GROUP BY first_name, last_name
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

Expected: `0 rows` (no results).

- [ ] **Step 6: Verify canonical Julie record is intact**

```sql
SELECT id, first_name, last_name, email, tier, health_score, stage, brokerage
FROM contacts
WHERE first_name = 'Julie' AND last_name = 'Jarmiolowski'
  AND deleted_at IS NULL;
```

Expected: exactly 1 row with `tier = 'A'`.

---

## Session 1 Complete -- Final Verification Checklist

Run through these to confirm all four tasks landed:

- [ ] `cd ~/crm && git remote -v` -- shows `origin` pointing to github.com
- [ ] `cd ~/crm && git log --oneline origin/feat/spine-phase1 -1` -- shows `3c10d37` (or your latest commit)
- [ ] `.env.local` contains `RESEND_WEBHOOK_SECRET=whsec_...` (non-empty value)
- [ ] Vercel project Settings > Environment Variables shows `RESEND_WEBHOOK_SECRET`
- [ ] Supabase SQL Editor: `SELECT count(*) FROM public.agent_health` returns positive number
- [ ] Supabase SQL Editor: `SELECT count(*) FROM public.agent_relationship_health` returns permission error
- [ ] Supabase SQL Editor: duplicate contacts query returns 0 rows

When all seven are checked, Session 1 is done. Open Session 2 plan to continue.

---

## What Session 2 Builds On This

- GitHub remote: Session 2 deploys Supabase edge functions. Having remote configured means you can push function code and track changes.
- RESEND_WEBHOOK_SECRET: Signal scan (Session 2) writes signals when contacts go cold. The Resend feedback loop ensures health scores update when those contacts open campaign emails later (Session 5).
- MV lockdown: Sessions 3-9 all read from `agent_health` view. The lockdown ensures the view filters correctly by `auth.uid()` from day one.
- Duplicate cleanup: Session 2's signal scan will fire `going_cold` for contacts who haven't been touched. Duplicates would generate two signals for the same person, cluttering the Today View.
