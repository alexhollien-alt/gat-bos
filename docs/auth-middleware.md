# Auth Middleware

## What it does

Next.js middleware that gates every non-API, non-intake route behind a
Supabase session cookie. It refreshes the session on every request, redirects
unauthenticated users to `/login`, redirects authenticated users away from
`/login` and `/signup`, and leaves `/api/*` and `/intake` alone so those
routes can handle their own contracts.

## Where it lives

`/Users/alex/crm/src/middleware.ts` (65 lines total).

## Key entry points

- `middleware(request)` at line 4
- Auth skip clause at lines 36 to 42
- Unauth redirect at lines 45 to 49
- Auth redirect at lines 51 to 55
- `config.matcher` at lines 60 to 64

## Flow

1. Build a mutable `NextResponse` from the incoming request
2. Create a Supabase SSR client via `createServerClient` from
   `@supabase/ssr`, wiring cookie read/write through
   `request.cookies.getAll()` and `supabaseResponse.cookies.set()`
3. Call `supabase.auth.getUser()`. This refreshes the cookie if the token
   needs rotation. The returned `user` object is the truth signal.
4. Compute `isAuthPage = /login || /signup`
5. Compute `isPublicRoute = /api/* || /intake`
6. If public, return early with the refreshed cookies attached
7. If no user and not on an auth page, redirect to `/login`
8. If user and on an auth page, redirect to `/dashboard`
9. Otherwise, return the refreshed response

## Matcher

```ts
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

Excludes Next static, image optimization, favicon, and common image
extensions. Everything else flows through the middleware once, including
API routes. The API skip happens inside the middleware body instead of in
the matcher so the cookie refresh still runs for session-auth API routes
like `/api/transcribe`.

## Why /api/* is excluded from redirects

Per `/Users/alex/CLAUDE.md` "Architecture / Auth" rule: API routes must
return JSON 401 responses, not HTML redirects to `/login`. An API client
calling `/api/contacts` without an auth header should get JSON back so the
caller can handle it. Redirecting to `/login` breaks JSON callers and wastes
a round-trip.

The middleware enforces this by returning early for `/api/*`. Individual
API routes assert their own auth contract:

- `/api/contacts`, `/api/contacts/[id]` -- bearer token via `requireApiToken`
- `/api/transcribe` -- session cookie via `supabase.auth.getUser()`
- `/api/intake` -- public, honeypot spam check
- `/api/webhooks/resend` -- public, no signature validation yet
- `/api/email/test` -- public dev smoke test

## Why /intake is excluded

`/intake` is a public agent-facing landing page. Agents who receive the link
do not have accounts. Auto-redirecting them to `/login` would kill the
funnel.

The intake form POSTs to `/api/intake`, which handles the honeypot check
and contact auto-create.

## Dependencies

- `@supabase/ssr` for `createServerClient`
- `next/server` for `NextResponse` and `NextRequest` types
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from env

## Known constraints

- Cookies MUST be set on both the request (for downstream server code) and
  the response (for the browser). The `setAll` closure at lines 15 to 23
  does both. Skipping the response set breaks login flow in Safari.
- `supabase.auth.getUser()` is the correct call, not `getSession()`. The
  `getSession()` method returns a cached value without validating the JWT
  and is unsafe to trust in middleware.
- Redirects use `request.nextUrl.clone()` to preserve host and scheme. Do
  not construct URLs from strings.

## Example: adding a new public route

If you need to expose a new marketing landing page at `/partners`:

```ts
const isPublicRoute =
  request.nextUrl.pathname.startsWith("/api/") ||
  request.nextUrl.pathname.startsWith("/intake") ||
  request.nextUrl.pathname.startsWith("/partners");
```

Keep the list explicit. Do not use a regex or data-driven lookup; the
middleware runs on every request and must stay fast.
