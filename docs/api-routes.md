# API Routes

Complete reference for every route under `/Users/alex/crm/src/app/api/`.
Middleware (`/Users/alex/crm/src/middleware.ts`) explicitly skips the
`/api/*` prefix, so each route handles its own auth.

## Route map

| Route | File | Method(s) | Auth |
|---|---|---|---|
| `/api/contacts` | `src/app/api/contacts/route.ts` | GET, POST | Bearer token |
| `/api/contacts/[id]` | `src/app/api/contacts/[id]/route.ts` | GET, PATCH | Bearer token |
| `/api/intake` | `src/app/api/intake/route.ts` | POST | Public (honeypot) |
| `/api/transcribe` | `src/app/api/transcribe/route.ts` | POST | Session cookie |
| `/api/email/test` | `src/app/api/email/test/route.ts` | POST | None (dev) |
| `/api/webhooks/resend` | `src/app/api/webhooks/resend/route.ts` | POST | Resend webhook (no validation) |

## /api/contacts (GET, POST)

File: `/Users/alex/crm/src/app/api/contacts/route.ts`

### GET

Bearer token required via `requireApiToken()`. Uses `adminClient` (service
role, bypasses RLS) to query `contacts` with `deleted_at IS NULL`, ordered
by `last_name` ascending. Query params:

| Param | Effect | Line |
|---|---|---|
| `name` | ILIKE match on `first_name` or `last_name` | 18-23 |
| `tier` | `eq("tier", tier)` | 26-29 |
| `stage` | `eq("stage", stage)` | 32-35 |
| `health_score_below` | `lt("health_score", parseInt(...))` | 38-41 |
| `stale_days` | `lt("last_touchpoint", today - N days)` | 44-49 |
| `exclude_tag` | `not("tags", "cs", "[tag]")` | 52-55 |
| `limit` | default 200 | 58-59 |

### POST

Creates a new contact. Requires `first_name` in the body. Hard-pins ownership
to `process.env.OWNER_USER_ID` (lines 77 to 83); the single-user constraint
is explicit. Strips `user_id`, `lead_status`, `company`, `source_detail` from
the payload before insert (lines 101 to 111), because schema history left
those field names in older external callers.

Returns 201 with the inserted row.

## /api/contacts/[id] (GET, PATCH)

File: `/Users/alex/crm/src/app/api/contacts/[id]/route.ts`

Both methods use bearer auth. GET returns the row or 404 on PGRST116. PATCH
strips `user_id` from the body (ownership is immutable via this endpoint)
and sets `updated_at` to now before the `.update()` call.

## /api/intake (POST)

File: `/Users/alex/crm/src/app/api/intake/route.ts`

Public route. No bearer token, auth deferred to honeypot field check
(line 54). If `body.honeypot` is non-empty, returns `{id: "ok"}` 201 silently
and does nothing. Required fields: `products` (non-empty array), `agent.agent_name`,
`agent.agent_email`.

Flow:

1. Load `OWNER_USER_ID` from env (hard pin, single-user)
2. Match existing contact by email (`ilike`) at line 63
3. If no match, insert a new contact with `tier: 'P'`, `stage: 'new'`,
   `source: 'website'`, `health_score: 30`, `type: 'realtor'`. Split the
   provided name on whitespace for first/last name
4. Build `listing_data` JSONB from `body.listing`, defaulting `state` to AZ
5. Insert a row into `material_requests` with `request_type: 'design_help'`,
   `status: 'submitted'`, `priority: 'standard'`, `source: 'intake'`,
   `submitter_name/email/phone`, and the listing JSONB
6. Insert one `material_request_items` row per selected product
7. If contact was auto-created, log a first-touch `interactions` row with
   `type: 'note'`, `direction: 'inbound'`, summary including the product list

Returns `{id, contactId, isNewContact}` on success.

## /api/transcribe (POST)

File: `/Users/alex/crm/src/app/api/transcribe/route.ts`

Session auth: uses `createClient()` from `@/lib/supabase/server` to verify
the `auth.getUser()` cookie (lines 22 to 30). Unauthenticated callers get
401 before any OpenAI cost is incurred.

Runtime: `nodejs` (not edge) because the OpenAI SDK file upload relies on
Node streams.

Accepts `multipart/form-data` with an `audio` field. Validates:

- Field present and is a `Blob`
- Non-zero size
- At most 25 MB (Whisper hard limit, constant at line 10)

Calls `openai.audio.transcriptions.create` with `model: 'whisper-1'`,
`response_format: 'json'`. Language is auto-detected. Returns `{text}`.

Env var: `OPENAI_API_KEY`.

## /api/email/test (POST)

File: `/Users/alex/crm/src/app/api/email/test/route.ts`

Trivial smoke test for Resend. Hard-coded subject, recipient, and body. Used
once to verify the Resend key is live. Should not ship to production as-is.
Calls `sendEmail` from `@/lib/resend`.

## /api/webhooks/resend (POST)

File: `/Users/alex/crm/src/app/api/webhooks/resend/route.ts`

Receives Resend email events and bumps `contacts.health_score`:

| Event | Score bump |
|---|---|
| `email.delivered` | +1 |
| `email.opened` | +3 |
| `email.clicked` | +5 |

Flow:

1. Parse webhook payload; bail silently if type is not in the accepted set
2. Lookup the contact by recipient email (uses service role client)
3. Bump `health_score` (cap at 100)
4. For `opened`/`clicked` events, insert an `interactions` row with
   `direction: 'inbound'`, summary `"Opened: {subject}"` or
   `"Clicked link in: {subject}"`

Note: this is the one place in the codebase that writes directly to
`contacts.health_score` outside the materialized view. Alex's manual gut
call always wins through the piece 3 coalesce view, so the webhook bump is
additive but gets overridden when Alex sets a rep_pulse within 14 days.

No signature validation on the webhook body. Add HMAC verification before
exposing in production.

## Shared helpers

`/Users/alex/crm/src/lib/api-auth.ts` exports `requireApiToken(request)`.
It reads `INTERNAL_API_TOKEN` from env, requires an
`Authorization: Bearer <token>` header, and uses `timingSafeEqual` from Node
`crypto` (lines 40 to 48) to avoid timing attacks. Returns `null` on success
or a pre-built `NextResponse.json(..., {status: 401})`.

`/Users/alex/crm/src/lib/supabase/admin.ts` exports `adminClient`, a
service-role Supabase client that bypasses RLS. Never import this in
browser code.

`/Users/alex/crm/src/lib/supabase/server.ts` exports `createClient()`, an
SSR cookie-backed client used by server components and session-auth API
routes.

## Why middleware skips /api/*

From `/Users/alex/crm/src/middleware.ts` line 37:

```ts
const isPublicRoute =
  request.nextUrl.pathname.startsWith("/api/") ||
  request.nextUrl.pathname.startsWith("/intake");

if (isPublicRoute) {
  return supabaseResponse;
}
```

API routes are "public" at the middleware layer but each route asserts its
own contract. This is required so unauthenticated callers get JSON 401
responses instead of HTML redirects to `/login` (per CLAUDE.md API auth
architecture rule).

## Dependencies

- `@supabase/ssr` for cookie-backed server client
- `@supabase/supabase-js` for the service-role admin client
- `openai` for `/api/transcribe`
- `resend` for `/api/email/test` and the webhook handler
- Node `crypto.timingSafeEqual` for bearer token comparison

## Known constraints

- Single-user system: every write path hard-pins ownership to
  `OWNER_USER_ID`. When multi-user lands, replace those reads with
  session-derived user IDs.
- No hard deletes anywhere. Reads filter `deleted_at IS NULL`. The live DB
  has a `deleted_at` column on `contacts`, `opportunities`, `deals`, and
  `follow_ups`.
- `first_name` is the only required contact field on POST. Everything else
  is optional.
