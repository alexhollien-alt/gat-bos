# Patch 03 -- Per-route zod validation (review-only sketch)

**Target paths:** every API route handler that accepts a body
**Action:** Land per-route, on next-touch. NOT autonomously applied.

---

## Pattern

Every POST/PUT/PATCH route handler that accepts a JSON body should:

```ts
import { z } from "zod";
import { NextResponse } from "next/server";

const RequestSchema = z.object({
  // ... fields
});

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const body = parsed.data;
  // ... rest of handler
}
```

Reference: `src/app/api/intake/route.ts` (lines 61-68) is the canonical example.

---

## Routes that need adoption (in priority order)

| Route | Reason | Schema location |
|-------|--------|-----------------|
| `/api/captures` (POST) | Public-ish (used by mobile capture); writes to captures table | New `src/lib/captures/types.ts` schema |
| `/api/contacts` (POST/PUT) | Hot write path | `src/lib/validations.ts` `contactSchema` already exists; just wire it in |
| `/api/projects` (POST/PUT) | Hot write path | New schema in `src/lib/projects/types.ts` (file exists) |
| `/api/email/generate-draft` (POST) | AI cost surface | New schema |
| `/api/email/approve-and-send` (POST) | Send authorization | New schema |
| `/api/calendar/create` (POST) | GCal write | New schema |
| `/api/transcribe` (POST) | OpenAI Whisper cost surface | Multipart form, not JSON; schema-validate the form fields |
| `/api/activity/interaction` (POST) | Audit trail | Schema using existing `activityVerb` union |

---

## Why each matters

A route that does `const body = await request.json(); await db.insert(body);` trusts the client. TypeScript types are erased at runtime. A malformed payload either:

- Writes a row that violates a CHECK constraint -> 500 + partial state.
- Writes a row that passes CHECK but breaks downstream readers -> silent corruption.
- Triggers an AI call with adversarial input -> wasted spend, possibly prompt-injection risk.

zod at the boundary catches all three.

---

## NOT a runnable patch

Each route is a separate PR. Bundle them under one branch named `infra/route-validation-rollout` and land 1 per day post-7A.5.
