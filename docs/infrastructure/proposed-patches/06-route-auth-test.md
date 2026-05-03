# Patch 06 -- Route auth assertion test (review-only sketch)

**Target path:** `~/crm/src/app/api/__tests__/route-auth.test.ts` (or `tests/route-auth.test.ts`)
**Action:** New test file. NOT autonomously runnable -- design is straightforward but file paths and globbing pattern need Alex's review.

---

## Why

`src/middleware.ts:36-44` bypasses ALL of `/api/*`. Each route MUST self-enforce auth. Today the pattern is convention-only: a future route that forgets to call one of `requireApiToken`, `verifyCronSecret`, `verifySession`, `verifyBearerOrSession`, or Svix-verify ships unauthenticated.

This test asserts every `route.ts` under `src/app/api/**` references at least one recognized auth helper, with an explicit allow-list for intentional public routes.

---

## Sketch

```ts
// src/app/api/__tests__/route-auth.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { glob } from "glob";

const PUBLIC_ALLOW_LIST = [
  "src/app/api/intake/route.ts",                 // public partner form, rate-limit + honeypot gated
  "src/app/api/webhooks/resend/route.ts",        // Svix HMAC gate
  "src/app/api/auth/gmail/authorize/route.ts",   // OAuth start
  "src/app/api/auth/gmail/callback/route.ts",    // OAuth return
];

const RECOGNIZED_AUTH_PATTERNS = [
  /requireApiToken\(/,
  /verifyCronSecret\(/,
  /verifySession\(/,
  /verifyBearerOrSession\(/,
  /verifySvixSignature\(/,           // only used by /api/webhooks/resend
];

const SVIX_PATTERNS = [/svix-signature/i, /timingSafeEqual/];

describe("API route auth coverage", () => {
  const routeFiles = glob.sync("src/app/api/**/route.ts", { cwd: process.cwd() });

  expect(routeFiles.length).toBeGreaterThan(20); // sanity

  for (const file of routeFiles) {
    if (PUBLIC_ALLOW_LIST.includes(file)) continue;

    it(`${file} enforces auth`, () => {
      const source = readFileSync(file, "utf8");
      const hasAuth = RECOGNIZED_AUTH_PATTERNS.some((p) => p.test(source))
                   || SVIX_PATTERNS.every((p) => p.test(source));
      expect(hasAuth, `Route ${file} does not appear to call any recognized auth helper`).toBe(true);
    });
  }
});
```

---

## Limits

- Source-text matching is brittle. A route that re-exports an auth helper or imports it under an alias would slip through. Tighten with AST parsing (`@typescript-eslint/parser`) when polish time allows.
- Routes that don't accept user input (e.g. a webhook from a service we control) still need auth; the test enforces this.
- New auth patterns require updating `RECOGNIZED_AUTH_PATTERNS`.

---

## Cookie hardening adjacent test

Add to the same file:

```ts
import { Cookies } from "@supabase/ssr";  // or trace through to actual cookie config

it("Supabase cookies use SameSite=Lax or Strict", () => {
  const middlewareSource = readFileSync("src/middleware.ts", "utf8");
  // Loose check; tighten when middleware grows.
  // Per security-audit.md S11.
  expect(middlewareSource).not.toMatch(/sameSite:\s*['"]none['"]/i);
});
```

---

## Land plan

Single PR; add to vitest config; verify it catches the absence (test by temporarily removing an auth call from a non-public route and confirming the test fails).
