# Phase 029 -- RSVP Landing Page (Berneil Broker Open)

**Status:** SUPERSEDED BY PARALLEL BUILD -- see audit findings at bottom of this file.
**Type:** BUILD (new product surface)
**Driver:** Friday May 29 broker open at Berneil (Denise van den Bossche).
**Branch (on lock):** `gsd/029-rsvp-berneil-landing` off `main`.

---

## Goal

Ship a public `/rsvp/[slug]` route with the first slug `berneil`, backed by two new tables (`events`, `event_rsvps`), a single public POST endpoint, Resend confirmation email, and an `activity_events` ledger insert per submission. Visual design matches the `vdb-berneil-broker-open.html` email aesthetic. No third-party form services. Email button href swap is a separate 2-minute follow-up after the production URL exists.

---

## Open Decisions (resolve before lock)

These are the gates that must be answered before code is written. Each has a recommended default in parens.

1. **`NEXT_PUBLIC_APP_URL` is missing in Vercel, but `NEXT_PUBLIC_SITE_URL` is set.** (Recommended: reuse `NEXT_PUBLIC_SITE_URL` everywhere the user spec called for `NEXT_PUBLIC_APP_URL`. Avoids a redundant env var. Confirmation email's `view-in-browser` link reads from this.)
2. **Resend confirmation email FROM address.** Wrapper currently hardcodes `"Alex Hollien <alex@alexhollienco.com>"`. Broker open is Denise-hosted. (Recommended: extend `sendViaResend()` to accept an optional `from` override, default unchanged, pass `"Denise van den Bossche <denise@alexhollienco.com>"` from the RSVP route. Sender domain stays verified; only the display name + local part change.)
3. **`activity_events.user_id` for an anonymous RSVP.** Per CRM convention, every event row carries a `user_id`. (Recommended: write under Alex's owner `user_id` resolved from an env var `OWNER_USER_ID` already used elsewhere -- same actor as the cron-side Weekly Edge writes. Backfill `actor_id` as the same value and store the submitter's email + name in `context` JSONB so reporting can attribute.)
4. **`event_rsvps` admin read scope.** Spec says "authenticated admin read for Denise/Alex." (Recommended: scope by `user_id = auth.uid()` matched against `events.user_id` for v1 -- i.e., the event owner. Denise gets her own portal session later; for now Alex is sole admin and his `user_id` owns the seeded `berneil` row. Avoids a roles table.)
5. **Confirmation email aesthetic source.** Recommended: reuse the visual system from `~/Desktop/vdb-berneil-broker-open.html` (Cormorant Garamond + Helvetica, bone + deep desert palette). Confirmation is a SHORTER variant: "Thanks for your RSVP" headline, event details block, "Add to Calendar" link, "Update your RSVP" link (regenerates form prefilled). No re-derivation of palette in this phase.

**Plan execution will pause for Alex to confirm Decisions 1-5 OR explicitly say "use the recommendations and go."**

---

## Env Var Verification (Gate 0)

Before any code, confirm these exist in Vercel **production** via `vercel env ls production`:

| Var | Status | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Present | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Present | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Present | |
| `RESEND_API_KEY` | ✅ Present | |
| `NEXT_PUBLIC_APP_URL` | ❌ **MISSING** | But `NEXT_PUBLIC_SITE_URL` IS present. Pause for Decision 1. |
| `OWNER_USER_ID` | ❓ Verify | Used in cron writes; confirm presence before relying on it in the route. |

Halt condition: if any required var is missing post-decision, write a `PASTE-INTO-ENV-rsvp.txt` per Rule 20 and pause for Alex to add via `vercel env add`.

---

## Dependency Graph

```
Gate 0: env verify
 │
 ▼
Gate 1: Migration A (events table)
Gate 2: Migration B (event_rsvps table)
 │
 ▼
Gate 3: supabase gen types --linked > src/lib/supabase/types.ts
 │
 ▼
Gate 4: Seed berneil event row (idempotent SQL in migration B or separate seed migration)
 │
 ├──────────────────┬──────────────────────┐
 ▼ ▼ ▼
Gate 5: ActivityVerb Gate 6: Resend Gate 7: Middleware
add event.rsvp.received `from` override public bypass for /rsvp
 param (NOT /api/rsvp -- already
 covered by /api/* bypass)
 │ │ │
 └──────────────────┴──────────────────────┘
 │
 ▼
Gate 8: /api/rsvp/submit POST handler
 (rate-limit by IP, insert event_rsvps, writeEvent, sendViaResend)
 │
 ▼
Gate 9: Confirmation email template (HTML + plaintext)
 │
 ▼
Gate 10: /rsvp/[slug] server component (fetch event by slug + status='live')
 │
 ▼
Gate 11: RSVPForm client component (form state, submit, success view)
 │
 ▼
Gate 12: Local E2E (curl + manual browser at localhost:3000/rsvp/berneil)
 │
 ▼
Gate 13: pnpm typecheck && pnpm build
 │
 ▼
Gate 14: PR open + Vercel preview verify
 │
 ▼
Gate 15: PR squash-merge → prod deploy
 │
 ▼
Gate 16: Prod smoke (submit a real RSVP, verify email + DB row + activity ledger)
 │
 ▼
Gate 17: SEPARATE -- swap mailto: → /rsvp/berneil URL in the broker-open email
 (NOT part of this phase, 2-minute edit post-deploy)
```

**Critical blockers:**
- Schema (Gates 1-2) blocks everything downstream.
- Types regen (Gate 3) blocks the API route (Gate 8) and components (Gates 10-11) from compiling.
- Resend `from` override (Gate 6) blocks the confirmation email path; if Decision 2 lands on "use Alex's address as-is," skip Gate 6.
- ActivityVerb add (Gate 5) blocks the API route from compiling.

---

## Schema (Gates 1-2)

### Migration A: `events` table

**Filename:** `supabase/migrations/<timestamp>_rsvp_events_table.sql` (timestamp generated by `supabase migration new rsvp_events_table`).

```sql
-- Events table: one row per Alex/Denise event with a public RSVP page.
CREATE TABLE IF NOT EXISTS public.events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 slug text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'closed', 'archived')),
 name text NOT NULL,
 hero_image_url text,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz,
 address_line1 text,
 address_line2 text,
 city text,
 region text,
 postal_code text,
 host_name text,
 host_title text,
 details_html text,
 rsvp_deadline_at timestamptz,
 capacity int,
 context jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS events_slug_unique
 ON public.events (slug) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_events_user_status
 ON public.events (user_id, status) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_updated_at_events()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at
 BEFORE UPDATE ON public.events
 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_events();

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Public read scoped to live events (anon + authenticated both allowed)
DROP POLICY IF EXISTS events_public_read_live ON public.events;
CREATE POLICY events_public_read_live ON public.events
 FOR SELECT TO anon, authenticated
 USING (status = 'live' AND deleted_at IS NULL);

-- Owner full access via auth.uid()
DROP POLICY IF EXISTS events_owner_all ON public.events;
CREATE POLICY events_owner_all ON public.events
 FOR ALL TO authenticated
 USING (user_id = auth.uid() AND deleted_at IS NULL)
 WITH CHECK (user_id = auth.uid());

-- Service role bypasses RLS by default; explicit policy not required but documented.

COMMENT ON TABLE public.events IS 'Events with public RSVP pages. Public read only when status = live.';
```

**Rollback companion:** `supabase/migrations/_rollbacks/<timestamp>_rsvp_events_table.sql` (DROP POLICY, DROP TRIGGER, DROP FUNCTION, DROP TABLE in reverse order).

---

### Migration B: `event_rsvps` table

**Filename:** `supabase/migrations/<timestamp>_rsvp_event_rsvps_table.sql`.

```sql
CREATE TABLE IF NOT EXISTS public.event_rsvps (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, -- mirrors event owner for RLS
 name text NOT NULL,
 email text NOT NULL,
 phone text,
 company text,
 attending boolean NOT NULL DEFAULT true,
 guest_count smallint NOT NULL DEFAULT 1 CHECK (guest_count BETWEEN 0 AND 10),
 notes text,
 source_ip inet,
 user_agent text,
 context jsonb NOT NULL DEFAULT '{}'::jsonb,
 confirmation_sent_at timestamptz,
 confirmation_message_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id_created
 ON public.event_rsvps (event_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_rsvps_email
 ON public.event_rsvps (lower(email)) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_updated_at_event_rsvps()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_event_rsvps_updated_at ON public.event_rsvps;
CREATE TRIGGER trg_event_rsvps_updated_at
 BEFORE UPDATE ON public.event_rsvps
 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_event_rsvps();

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- NO public read policy. anon cannot read this table at all.
-- Authenticated admin read: only the event owner sees rows.
DROP POLICY IF EXISTS event_rsvps_owner_select ON public.event_rsvps;
CREATE POLICY event_rsvps_owner_select ON public.event_rsvps
 FOR SELECT TO authenticated
 USING (
 user_id = auth.uid()
 AND deleted_at IS NULL
 AND EXISTS (
 SELECT 1 FROM public.events e
 WHERE e.id = event_rsvps.event_id
 AND e.user_id = auth.uid()
 AND e.deleted_at IS NULL
 )
 );

-- Owner soft-update (e.g., mark attended, edit notes)
DROP POLICY IF EXISTS event_rsvps_owner_update ON public.event_rsvps;
CREATE POLICY event_rsvps_owner_update ON public.event_rsvps
 FOR UPDATE TO authenticated
 USING (user_id = auth.uid())
 WITH CHECK (user_id = auth.uid());

-- NO insert/delete policies for anon or authenticated.
-- All writes route through service-role POST /api/rsvp/submit which bypasses RLS.

COMMENT ON TABLE public.event_rsvps IS 'RSVP submissions. Service-role inserts only via /api/rsvp/submit. Owner-only read.';
```

**Rollback:** mirror DROP order.

---

### Seed (Gate 4)

Idempotent seed inside Migration B (or a separate `<timestamp>_rsvp_seed_berneil.sql`):

```sql
INSERT INTO public.events (
 user_id, slug, status, name,
 starts_at, ends_at,
 address_line1, city, region, postal_code,
 host_name, host_title,
 details_html,
 rsvp_deadline_at
) VALUES (
 '<OWNER_USER_ID resolved from auth.users WHERE email = alex@alexhollienco.com>',
 'berneil',
 'live',
 'Berneil Broker Open',
 '2026-05-29 11:00:00-07'::timestamptz,
 '2026-05-29 14:00:00-07'::timestamptz,
 '[PLACEHOLDER: Berneil street address]',
 'Paradise Valley',
 'AZ',
 '[PLACEHOLDER: postal code]',
 'Denise van den Bossche',
 'Listing Agent',
 '<p>[PLACEHOLDER: details copy from vdb-berneil-broker-open.html]</p>',
 '2026-05-28 17:00:00-07'::timestamptz
)
ON CONFLICT DO NOTHING;
```

**Pause for Alex:** the address, postal code, and details copy are placeholders. Plan execution will halt here and ask Alex to paste from the existing email source. The OWNER_USER_ID lookup is a `SELECT id FROM auth.users WHERE email = 'alex@alexhollienco.com'` inline subquery.

---

## TypeScript Surface (Gates 5-6)

### Gate 5: ActivityVerb addition

**File:** `src/lib/activity/types.ts`.

Add the literal `'event.rsvp.received'` to the `ActivityVerb` union. This is a **TypeScript-only change**, no migration. The `activity_events.verb` column is text; the union exists for autocomplete + grep discipline.

Convention check: existing verbs follow dot-namespace (`event.invite.queued`, `event.invite.sent`, `campaign.draft_created`, `ticket.status_changed`). `event.rsvp.received` fits.

### Gate 6: Resend `from` override

**File:** `src/lib/messaging/adapters/resend.ts`.

Current shape: `sendViaResend({ to, subject, html, text })` -- `from` hardcoded.

Proposed change (minimal, backward-compatible):

```ts
export type AdapterSendInput = {
 to: string;
 subject: string;
 html: string;
 text: string;
 from?: string; // NEW: optional override, defaults to "Alex Hollien <alex@alexhollienco.com>"
};
```

Internal default unchanged when `from` is undefined. All existing call sites continue working untouched. Skip this gate if Decision 2 lands on "use Alex's address."

---

## API Route (Gate 8)

**File:** `src/app/api/rsvp/submit/route.ts` (new).

```ts
// Pseudo-code shape; full code emitted in execute-phase.
export async function POST(req: NextRequest) {
 // 1. Rate-limit by IP (existing checkRateLimit, key = `rsvp:${ip}`, 5 req / 60 sec).
 // 2. Parse + validate body with Zod (rsvpSubmitSchema: slug, name, email, phone?, guest_count?, notes?).
 // 3. Load event: adminClient.from('events').select().eq('slug', slug).eq('status', 'live').is('deleted_at', null).single().
 // 404 if not found.
 // 4. Insert event_rsvps row with adminClient (service-role bypass).
 // 5. writeEvent({ userId: event.user_id, actorId: event.user_id, verb: 'event.rsvp.received', object: { table: 'event_rsvps', id: insertedId }, context: { event_id, slug, name, email, guest_count } }).
 // 6. Render confirmation email (next gate) and sendViaResend({ to: email, from: optional Denise override, subject, html, text }).
 // 7. PATCH event_rsvps row with confirmation_sent_at + confirmation_message_id.
 // 8. Return JSON { ok: true, id: insertedId }.
 // On any failure between steps 4 and 7: never break the user flow. Log via existing logError pattern. Still return ok if step 4 succeeded -- confirmation email is best-effort.
}
```

**Zod schema:** `src/lib/schemas/rsvp.ts` (new), `rsvpSubmitSchema` with `email().min(1)`, `name.min(2).max(120)`, `guest_count.int().min(0).max(10).optional()`, `notes.max(500).optional()`.

---

## Confirmation Email (Gate 9)

**File:** `src/lib/email/templates/rsvp-confirmation.ts` (new).

Single function:
```ts
export function renderRsvpConfirmation(opts: {
 rsvp: { name: string; guest_count: number };
 event: { name: string; starts_at: string; ends_at?: string; address_line1?: string; city?: string; region?: string; postal_code?: string; host_name?: string };
 manageUrl?: string; // future: /rsvp/[slug]?token= for edits
 viewInBrowserUrl: string; // /rsvp/[slug]
}): { subject: string; html: string; text: string }
```

Aesthetic: Cormorant Garamond + Helvetica, bone background (`#F5F1EB` or whatever Decision 5's source uses), deep desert headline (`#3C2E22` ish). Lift the palette + typography from `~/Desktop/vdb-berneil-broker-open.html` directly. **Do NOT re-derive.** Plan will read that file at execute time and copy the inline styles.

Subject: `"You're on the list -- Berneil broker open, Friday May 29"`.

Body sections:
1. Italic headline: "Thanks for your RSVP."
2. Event card: name + date (formatted Phoenix wall-clock) + address.
3. "Add to calendar" link (ICS data URI inline, generated client-side fallback).
4. Soft CTA back to `/rsvp/berneil` for edits.

---

## Frontend (Gates 10-11)

### Gate 10: Server component `src/app/rsvp/[slug]/page.tsx`

- Fetch event via anon client `createServerClient` (RLS handles `status='live'` filter).
- 404 if not found.
- Render hero photo (from `events.hero_image_url`), italic headline, event details, embedded `<RsvpForm />` client component.
- SEO: per Standing Rule 11, JSON-LD `Event` schema, Open Graph tags, unique title.
- `force-dynamic` or `revalidate = 60` -- favor revalidate so the page isn't refetched per visitor.

### Gate 11: Client component `src/app/rsvp/[slug]/RsvpForm.tsx`

- React Hook Form + zodResolver against `rsvpSubmitSchema`.
- Submit → `fetch('/api/rsvp/submit', { method: 'POST', body: JSON.stringify({ slug, ...formValues }) })`.
- On 200: swap form for a confirmation card (same Cormorant + bone aesthetic, "You're in. Confirmation sent to {email}.").
- On 429: surface "Too many requests -- try again in a minute" toast.
- On other error: surface generic "Something went wrong" with retry.
- Disable submit while pending.
- No tracking scripts, no third-party SDKs.

---

## Middleware (Gate 7)

**File:** `src/middleware.ts`.

Verify `/api/*` is already in the bypass list (confirmed line 48). **Only need to add `/rsvp`** for the public page:

```ts
const isPublicRoute =
 pathname.startsWith("/api/") ||
 pathname.startsWith("/intake") ||
 pathname.startsWith("/agents/") ||
 pathname.startsWith("/agent/") ||
 pathname.startsWith("/rsvp") || // NEW
 isPortalPublic;
```

Standing Rule 17: run `pnpm dev` after middleware change to confirm /rsvp/berneil renders.

---

## Verification (Gates 12-16)

### Gate 12: Local E2E

1. `pnpm dev` (probe :3000 and :3001 per Rule 17).
2. Apply migrations to local Docker: `supabase db reset` OR `supabase db push --local` if local link exists.
3. `curl http://localhost:3000/rsvp/berneil` → expect 200 HTML with form.
4. `curl -X POST http://localhost:3000/api/rsvp/submit -H 'Content-Type: application/json' -d '{"slug":"berneil","name":"Test User","email":"test@example.com","guest_count":2}'` → expect 200 `{"ok":true,"id":"..."}`.
5. Local Supabase: `SELECT * FROM event_rsvps WHERE email='test@example.com'` → 1 row.
6. Local Supabase: `SELECT * FROM activity_events WHERE verb='event.rsvp.received'` → 1 row.
7. Resend dashboard (or `RESEND_SAFE_RECIPIENT` log line) → confirmation queued.
8. Visit `/rsvp/berneil` in browser, submit form manually, see confirmation card swap in.

### Gate 13: Quality gates

```
cd ~/crm && pnpm typecheck && pnpm build
```

Both must PASS. Em-dash + banned-word grep clean on every touched file.

### Gate 14: PR + Vercel preview

- Push branch.
- Open PR with body listing every gate and its result.
- Vercel preview URL: visit `/rsvp/berneil` on the preview, submit a test RSVP to `alex@alexhollienco.com`, confirm email arrives in inbox.

### Gate 15: Merge

Per `automation.md` Phase Completion Protocol, on Alex "ship it":
```
gh pr create --fill && gh pr merge --squash --delete-branch && git checkout main && git pull
```

### Gate 16: Prod smoke

- Submit one real RSVP through `gat-bos.vercel.app/rsvp/berneil` (or alias).
- Confirm: (1) email arrives, (2) `event_rsvps` prod row exists, (3) `activity_events` row exists with `verb='event.rsvp.received'`, (4) no rows in `error_logs` for `endpoint='/api/rsvp/submit'`.

### Gate 17: Email button href swap (SEPARATE, NOT part of this phase)

Once prod is green, edit the broker-open email's button `href` from `mailto:` to `https://gat-bos.vercel.app/rsvp/berneil`. 2-minute edit. Tracked here for completeness; does not block phase closure.

---

## Out of Scope

- Mobile-optimized capture / camera scanning (not needed for an RSVP form).
- Edit-after-submit token flow (referenced in confirmation email as "future: /rsvp/[slug]?token=" but token issuance + verification deferred).
- Admin RSVP-list dashboard surface in the CRM (`/events/[slug]/rsvps`). Owner can query Supabase directly until that ships in a follow-up phase.
- Capacity enforcement at submit time (CHECK + count gate). v1 accepts unlimited; capacity field exists for display only.
- ICS calendar attachment beyond a data-URI link (no rich .ics file gen).
- Multiple events / slugs beyond `berneil`. Schema supports it; only `berneil` seeded.
- Resend webhook → `activity_events` delivery telemetry (existing blocker, not RSVP-specific).
- Twilio / SMS confirmations. None. Email-only.
- Spam / honeypot field. Rate-limit by IP is the only gate v1.

---

## Standing Rules Audit

| Rule | Status |
|---|---|
| Rule 1 (fill and flag) | Address/details placeholders flagged for Alex |
| Rule 3 (no hard deletes) | Both tables have `deleted_at`; no DELETE statements anywhere in code |
| Rule 5 (consequence-based approval) | PR merge + prod deploy are the only production-write gates; both via `automation.md` |
| Rule 11 (SEO minimum) | JSON-LD Event, OG tags, unique title in Gate 10 |
| Rule 17 (dev server port probe) | Gate 12 step 1 |
| Rule 18 (auto-open) | N/A -- no Desktop output |
| Rule 23 (Supabase CLI) | All schema via `supabase migration new` + `supabase db push` |
| Rule 25 (no abstractions) | No new helpers beyond `renderRsvpConfirmation`. Reuse: rate-limit, writeEvent, sendViaResend, adminClient, serverClient |
| Karpathy P1 (think before coding) | Open Decisions block above |
| Karpathy P2 (simplicity) | One route, two tables, one email template, one form. No state library, no edit-token v1 |
| Karpathy P3 (surgical) | Only middleware + types.ts + resend.ts touched on existing surfaces |

---

## Acceptance Gates Summary

| # | Gate | Pass = |
|---|---|---|
| 0 | Env vars | 4/5 confirmed in Vercel prod, NEXT_PUBLIC_APP_URL decision made |
| 1 | events migration | Pushed local + prod, types regenerated |
| 2 | event_rsvps migration | Pushed local + prod, types regenerated |
| 3 | types regen | `src/lib/supabase/types.ts` has Row/Insert/Update for both new tables |
| 4 | berneil seed | One row, slug='berneil', status='live' |
| 5 | ActivityVerb | `'event.rsvp.received'` in union, typecheck clean |
| 6 | Resend `from` override | Optional param added, default unchanged, all callers green |
| 7 | Middleware bypass | `/rsvp` in `isPublicRoute` |
| 8 | POST /api/rsvp/submit | Returns 200 on valid body, 400 on invalid, 429 on rate limit |
| 9 | Confirmation email | Renders subject + html + text, matches vdb-berneil aesthetic |
| 10 | /rsvp/[slug] page | Renders with hero, details, embedded form, SEO metadata clean |
| 11 | RsvpForm | Submits, swaps to success state, surfaces 429 + generic errors |
| 12 | Local E2E | All 8 substeps green |
| 13 | typecheck + build | Both PASS |
| 14 | PR + preview | Preview URL submits successfully, email lands |
| 15 | Merge | PR squash-merged to main |
| 16 | Prod smoke | Real RSVP → email + DB row + activity row, no error_logs |

---

## Files Touched (final list)

**Create:**
- `supabase/migrations/<ts>_rsvp_events_table.sql` + rollback
- `supabase/migrations/<ts>_rsvp_event_rsvps_table.sql` + rollback
- `supabase/migrations/<ts>_rsvp_seed_berneil.sql` (or fold into Migration B)
- `src/lib/schemas/rsvp.ts`
- `src/lib/email/templates/rsvp-confirmation.ts`
- `src/app/api/rsvp/submit/route.ts`
- `src/app/rsvp/[slug]/page.tsx`
- `src/app/rsvp/[slug]/RsvpForm.tsx`

**Modify:**
- `src/lib/supabase/types.ts` (regenerated)
- `src/lib/activity/types.ts` (add verb)
- `src/lib/messaging/adapters/resend.ts` (optional `from` override -- skip if Decision 2 = no)
- `src/middleware.ts` (add `/rsvp` to bypass)

Remaining placeholders: Berneil street address, postal code, details copy (Alex to provide at Gate 4). Owner user_id resolution (inline SELECT in seed).

---

**END OF PLAN.** Awaiting "lock it" or "go" to trigger execution.

---

# AUDIT REPORT (2026-05-22)

**Auditor mode.** Phase 029 was built in parallel by a separate session before this plan reached Gate 0. Files reviewed:

- `supabase/migrations/20260522164803_rsvp_landing_page.sql`
- `src/lib/activity/types.ts`
- `src/middleware.ts`
- `src/lib/rsvp/schema.ts`
- `src/lib/rsvp/confirmation-email.ts`
- `src/lib/rsvp/send-confirmation.ts`
- `src/app/api/rsvp/submit/route.ts`
- `src/app/rsvp/[slug]/page.tsx`
- `src/app/rsvp/[slug]/RSVPForm.tsx`

---

## a. MATCHES PLAN

1. **Rate limiter reuse.** `checkRateLimit("ratelimit:rsvp:${ip}", 5, 3600)` matches the planned IP-keyed reuse pattern from `/api/captures`. No new IP limiter needed (confirmed pre-build).
2. **ActivityVerb addition.** `event.rsvp.received` added to the union at `src/lib/activity/types.ts:63`. Dot-namespace convention preserved. TypeScript-only, not a schema change.
3. **Middleware bypass.** `/rsvp/` added to `isPublicRoute` at `src/middleware.ts:52`. `/api/*` already covered `/api/rsvp/submit` per the audit.
4. **writeEvent shape.** `userId = ownerId, actorId = ownerId, verb = "event.rsvp.received", object = { table: "event_rsvps", id: rsvp.id }, context = { event_id, event_slug, rsvp_name, rsvp_email, rsvp_brokerage, guest_count }`. Matches the planned signature.
5. **Service-role inserts on `event_rsvps`.** `adminClient` used in `/api/rsvp/submit/route.ts`. RLS-bypassing inserts as planned.
6. **Public read of `public_events` scoped to `status = 'live'`.** Policy `public_events_read_live ON public.public_events FOR SELECT TO anon, authenticated USING (status = 'live' AND deleted_at IS NULL)` matches the plan verbatim except for table-name.
7. **Soft-delete columns** (`deleted_at`) on both new tables -- Rule 3 honored.
8. **Visual stack.** Cormorant Garamond + Helvetica, bone `#F5F0E8`, ink `#1F1B16`, terracotta `#9B6B4A`. Matches the planned palette source (`vdb-berneil-broker-open.html`).
9. **Best-effort Resend pattern.** Route persists `event_rsvps` row + writes `activity_events`, then attempts confirmation send; failure does not bounce the form. Matches planned pattern.
10. **Resend `from` override.** `sendRsvpConfirmation` accepts optional `fromOverride` -- matches the planned wrapper extension (though implemented in a sibling `send-confirmation.ts`, not by patching `resend.ts`).

---

## b. DIVERGES FROM PLAN

| # | Built | Plan | Assessment |
|---|---|---|---|
| 1 | New table `public_events` | Plan added a NEW `events` table | **BETTER.** A `public.events` table already exists (calendar/gcal-tied). The parallel session avoided the name collision the plan would have caused. |
| 2 | `event_rsvps` has NO `user_id` column | Plan mirrored event owner's `user_id` | **BETTER.** Owner relationship enforced indirectly via `event_id` FK + no authenticated read policy. Cleaner schema. |
| 3 | `event_rsvps` RLS: zero policies (service-role only) | Plan: owner SELECT + UPDATE policies for authenticated | **NEUTRAL / TIGHTER.** Decision 4 in the plan asked exactly this. Build chose strictest scope. Means any future admin UI must go through server-side API + service role; cannot query directly from a logged-in browser. Acceptable for v1. |
| 4 | `host_contact_id uuid REFERENCES contacts(id)` on `public_events` | Plan denormalized `host_name` + `host_title` text | **MIXED.** FK to `contacts` is forward-looking (right call -- `contacts` not `agents`, since `agents` is a `type=` filter on `contacts`). HOWEVER the FK is never populated and the host lookup runs through a hardcoded `HOST_BY_SLUG` map. Worst of both worlds. See finding (c.5). |
| 5 | Single migration file with embedded seed | Plan: 2-3 separate migrations | **BETTER.** Single migration is cleaner; sequential migrations were not required. |
| 6 | `event_end NOT NULL` | Plan: `ends_at` nullable | **BETTER.** Broker opens always have an end time. |
| 7 | Single `address` text column | Plan: granular `address_line1/2`, `city`, `region`, `postal_code` | **BETTER.** Plan was over-engineered for v1. |
| 8 | No `capacity`, no `rsvp_deadline_at` | Plan: both columns | **BETTER.** YAGNI -- v1 has no capacity enforcement and no deadline display. |
| 9 | `guest_count CHECK (BETWEEN 1 AND 2)` | Plan: 0-10 | **BETTER.** Tighter, matches broker-open reality. |
| 10 | `brokerage` field added to `event_rsvps` + form | Plan: `company` (no brokerage) | **BETTER.** Domain-specific naming. |
| 11 | Honeypot field implemented | Plan: "Out of scope" | **BETTER.** Free bot defense, well-scoped. |
| 12 | `.ics` calendar invite as Resend attachment | Plan: "Add to Calendar" link / data URI | **BETTER.** Native attachment renders correctly across Gmail/Outlook/Apple Mail. |
| 13 | `replyTo: args.hostEmail` in Resend send | Plan: silent on replyTo | **BETTER.** Replies route to Denise, not to a generic inbox. |
| 14 | ESLint file-level disables for `no-restricted-syntax` (hex colors) | Plan: lift colors from email source, silent on ESLint | **WORSE.** Improvised disable with justification comment. Brand.md Color section bans raw hex codes; the rule was bypassed instead of solved. Correct fix: define `--rsvp-bone`, `--rsvp-ink`, `--rsvp-accent` CSS variables scoped to the route layout, reference via `var()`. See finding (c.3). |
| 15 | `<link rel="stylesheet">` to Google Fonts for Cormorant Garamond + second ESLint disable for `no-page-custom-font` | Plan: lift inline from email source | **NEUTRAL-WORSE.** Should use `next/font/google` to avoid layout shift + ESLint disable. P3 polish item. |
| 16 | `page.tsx` reads via `adminClient` (service role) | Plan: anon client to exercise RLS | **NEUTRAL.** Functionally equivalent given `status = 'live'` filter is applied in the query. Means the RLS policy is unused by the page render -- a bug in the policy wouldn't surface here. Tighter principle would be anon. |
| 17 | Confirmation FROM: `${hostName} <${process.env.RSVP_FROM_EMAIL ?? "rsvp@alexhollienco.com"}>` | Plan: `from?` override, default unchanged | **NEUTRAL.** Requires the Resend domain to accept `rsvp@alexhollienco.com` as a sender (alexhollienco.com is the verified domain so any local part works via DKIM). Needs explicit env-var verification. |
| 18 | Seeded event title: `"An Evening at Berneil"`, subtitle `"A Private Broker Preview"`, start 16:00 Phoenix, end 18:00 Phoenix | Plan: title `"Berneil Broker Open"`, start 11:00, end 14:00 | **NEUTRAL** (copy decisions belong to Alex). Time-of-day needs Alex confirmation. |
| 19 | Migration adds `public_events_set_updated_at` trigger but `event_rsvps` has NO `updated_at` column or trigger | Plan: both tables get the trigger | **BETTER.** RSVPs are immutable in v1. |
| 20 | Phase 029 branch NOT visible -- assumed already executed via the automation Phase Completion Protocol | Plan: `gsd/029-rsvp-berneil-landing` branch off main | Verify before audit closes. Build claim is `pnpm typecheck` + `pnpm build` PASS. |

---

## c. PLAN GAPS (items in plan the parallel build did NOT address)

1. **JSON-LD `Event` schema markup.** Standing Rule 11 requires JSON-LD on every web HTML output. `page.tsx` has `title` + `description` + `openGraph` but NO JSON-LD `Event` block. **P1 fix required.**
2. **`logError()` integration for Resend failures.** `send-confirmation.ts` uses `console.error` only. Vercel rotates logs; per the BLOCKERS.md PR #31 + #32 pattern, the CRM has a canonical `logError(ROUTE, ...)` pattern that surfaces in the `error_logs` table. Without it, silent Resend failures are diagnosed by absence, not by a row. **P1 fix.**
3. **Route-scoped CSS variables for the divergent palette.** Per brand.md, raw hex in source files violates Color section. The disable-comment shortcut works but is not the canonical pattern. **P2 cleanup.**
4. **`(event_id, lower(email))` uniqueness constraint OR explicit dedupe story.** Build allows the same email to RSVP repeatedly. For Berneil low harm (Denise sees two confirmations); for larger events, dedupe matters. **P2 / defer to v2.**
5. **Owner read of `event_rsvps` via authenticated session.** Plan called for owner-only SELECT via auth.uid(). Build chose service-role-only. If Denise/Alex want a CRM admin UI listing RSVPs in the future, that UI must go through a server-side API. **P2 noted; not blocking ship.**

---

## d. Specific audit points (per request)

### d.1 RLS policies on `public_events` and `event_rsvps`

- **`public_events`:** ONE policy. `public_events_read_live` (anon + authenticated SELECT where `status = 'live' AND deleted_at IS NULL`). Service-role writes only. Matches plan, minus the owner_all policy for authenticated writes (which the plan included but isn't required for v1).
- **`event_rsvps`:** RLS enabled, ZERO policies. Service-role only. Tighter than plan's owner-SELECT policy.
- Both tables: no public DELETE, no public UPDATE. Soft-delete columns present.
- **Match assessment:** Correct in shape, tighter in scope than the plan called for. RLS policy SQL diverges only in table naming (`public_events` vs `events`) which is a strict improvement (no collision with the existing `events` calendar table).

### d.2 `host_contact_id` FK decision

- `public_events.host_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL`.
- Correctly references `contacts` (not `agents`, which doesn't exist as a separate table -- `agents` is `contacts WHERE type = 'agent'`).
- **BUT:** the column is **NEVER POPULATED.** Seeded Berneil row omits it. API route ignores it and reads from a hardcoded `HOST_BY_SLUG` constant.
- **Assessment:** Right schema, wrong wiring. The host metadata path bypasses the FK entirely. See (c.5).

### d.3 ESLint hex-color ban file-level disable for `/rsvp/`

- **Improvised.** Plan did not anticipate the rule. Brand.md Color section forbids raw hex in source: "Never hardcode a hex code, rgb, or hsl in a skill, rule, context, theme, or template file."
- Two disable directives in `page.tsx` (lines 1-7), one in `RSVPForm.tsx` (lines 1-4), with justification comments referencing scope.
- **Assessment:** Justification comments are well-written and reference "one-off marketing palette scoped to this route." Reasonable but not canonical. The cleaner fix: define `:root { --rsvp-bone: #F5F0E8; --rsvp-ink: #1F1B16; --rsvp-accent: #9B6B4A; }` in a route-local `layout.tsx` or imported CSS module, then reference via `var(--rsvp-bone)` etc. Same scoping, no rule violation. **P2 cleanup, not a ship blocker.**

### d.4 "Best-effort Resend, RSVP persists even if email fails"

- **Pattern is correct.** Route persists RSVP + writes activity_events row + returns 201, then attempts send. Send failure logged to console + return `{messageId: null, error: ...}` to caller; caller does not throw.
- **Gap:** No `logError()` to `error_logs`. Vercel logs rotate; failures become invisible after retention window.
- **Gap:** No `confirmation_message_id` patched on failure means a query `SELECT * FROM event_rsvps WHERE confirmation_message_id IS NULL` surfaces failures but the *reason* lives only in console logs (gone).
- **Assessment:** RIGHT pattern, INCOMPLETE observability. **P1: add logError integration before high-volume use.**

### d.5 `HOST_BY_SLUG.berneil` hardcoded constant

```ts
const HOST_BY_SLUG: Record<string, {...}> = {
  berneil: {
    name: "Denise Van Den Bossche",
    email: "denisevdb@exec-elite.com",
    phone: "[PLACEHOLDER: Denise mobile]",
  },
};
```

- **Hardcoded data that belongs in the DB.** Three concrete issues:
  1. Adding a second event requires a code deploy. Defeats the slug-driven design.
  2. `phone: "[PLACEHOLDER: Denise mobile]"` is a literal string. Currently this **WILL RENDER** in the confirmation email both as display text and as the `href` of a `<a href="tel:...">` link. **SHIP BLOCKER.**
  3. `host_contact_id` exists on the table but is unused. The proper path: seed Berneil row with `host_contact_id = '<Denise contact id>'`, JOIN to `contacts` in the event lookup, read `host.full_name`, `host.email`, `host.phone` from contacts.
- **Assessment:** Wrong pattern. Plan had host metadata correctly tied to the event row. **P0 refactor required before shipping multiple events; P0 phone-placeholder fix required before launching this one.**

---

## e. Additional findings beyond the requested audit points

- **e.1 SHIP BUG: `hostFirstName` regex in `page.tsx:324`** extracts "Berneil" from the title `"An Evening at Berneil"` via `match(/at\s+(\w+)/i)`. Passed to `<RSVPForm hostFirstName="Berneil">`. The success card renders **"Berneil looks forward to seeing you."** which is gibberish (Berneil is the property, not the host). Must pass `hostFirstName="Denise"` from server-side host metadata. **P0.**
- **e.2 SHIP BUG: phone placeholder.** Per d.5.2.
- **e.3 Footer hardcoded.** `"Exec Elite Partners · Realty Executives"` + `"Denise Van Den Bossche"` + email hardcoded in JSX at `page.tsx:343-370`. Same coupling issue as HOST_BY_SLUG. Bind to host contact at render time.
- **e.4 Missing JSON-LD Event schema** per c.1.
- **e.5 Build claim unverified.** User reports `pnpm typecheck` + `pnpm build` pass. Auditor did not run them in this session.
- **e.6 Time-of-day decision.** Seed has 4:00 PM - 6:00 PM Phoenix. Confirm against Denise's actual schedule before going live.
- **e.7 ESLint disables in two files** vs. canonical CSS-variable scoping per c.3.

---

## VERDICT

**REFACTOR SPECIFIC PIECES, then ship.** Do NOT roll back; the build is materially better than the plan in 9 of 20 divergences and equivalent in another 7. The shape is right. Specific items to fix:

### P0 -- must fix before any send to a real RSVP submitter

1. **Replace `hostFirstName` title-regex with explicit host metadata** (`page.tsx:324`). Pass `hostFirstName="Denise"` (or read from host contact after refactor below).
2. **Replace `HOST_BY_SLUG.berneil.phone` placeholder** with Denise's real mobile, OR remove the phone path from the confirmation email until known.

### P1 -- fix before broad announcement, OK to test internally first

3. **Replace `HOST_BY_SLUG` map with `contacts` JOIN.** Populate `public_events.host_contact_id` on the Berneil seed row (add Denise to `contacts` if she's not there yet -- check by email `denisevdb@exec-elite.com`). Change `/api/rsvp/submit/route.ts` to select `host_contact_id` and JOIN `contacts` for name + email + phone. Dynamic for future events.
4. **Add JSON-LD Event schema to `page.tsx`** per Standing Rule 11.
5. **Add `logError(ROUTE, message, context, statusCode)` calls in `send-confirmation.ts`** catch paths + Resend error path. Surface failures in `error_logs` table per the PR #31 + #32 pattern.
6. **Bind footer brokerage + name + email to host contact** (`page.tsx:343-370`). Currently hardcoded to Denise/Exec Elite.

### P2 -- polish, OK to ship without

7. Replace ESLint disables with route-scoped CSS variables in a route-local layout.
8. Swap Google Fonts `<link>` for `next/font/google` for Cormorant Garamond.
9. Swap `page.tsx` `adminClient` to anon client to exercise RLS policy.
10. Add `(event_id, lower(email))` unique partial index OR documented dedupe story.

### Confirm before live

11. Event start/end time (4:00 PM - 6:00 PM Phoenix) -- correct?
12. `RSVP_FROM_EMAIL` env var -- is `rsvp@alexhollienco.com` the intended sender local part? Or use a different verified address?
13. Verify `pnpm typecheck && pnpm build` PASS in CI before merging.
14. Confirm `denisevdb@exec-elite.com` exists in `contacts` table (or add as part of P1 refactor).

### Keep as-built

- `public_events` table naming (avoids collision)
- Tighter columns (no rsvp_deadline_at, capacity, granular address)
- Honeypot field
- `brokerage` field on submit + RSVP rows
- `guest_count` CHECK 1-2
- ICS attachment
- `replyTo: hostEmail` in Resend send
- Single migration file
- Tighter RLS on `event_rsvps` (service-role only)
- ESLint disables retained TEMPORARILY pending P2 CSS-var migration

**END OF AUDIT.**
