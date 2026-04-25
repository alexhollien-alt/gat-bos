import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import {
  intakeSchema,
  processIntake,
  IntakeProcessingError,
  type IntakePayload,
} from "@/lib/intake/process";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { extractIp } from "@/lib/rate-limit/extract-ip";

// Public, unauthenticated endpoint. Service-role writes happen via
// adminClient. Validation, sanitization, and orchestration live in
// src/lib/intake/process.ts -- this handler owns env-var checks, JSON
// parsing, schema dispatch, honeypot short-circuit, and HTTP response
// shaping. See process.ts for the three-layer defense rationale.

// Rate limit: 10 submissions per 5-minute sliding window per IP. Sized for
// a public form a real partner fills out once or twice; well below any
// legitimate burst pattern. Fails open on Supabase error -- availability
// over enforcement on the inbound write path.
const INTAKE_RATE_LIMIT = 10;
const INTAKE_RATE_WINDOW_SEC = 5 * 60;

export async function POST(request: Request) {
  try {
    const ip = extractIp(request.headers);
    const rl = await checkRateLimit(
      `ratelimit:intake:${ip}`,
      INTAKE_RATE_LIMIT,
      INTAKE_RATE_WINDOW_SEC,
    );
    if (!rl.allowed) {
      const retryAfter = Math.max(
        1,
        Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000),
      );
      return NextResponse.json(
        { error: "rate_limited", retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    // Hard-pinned CRM owner. Set OWNER_USER_ID in .env.local to Alex's
    // auth.users id (b735d691-4d86-4e31-9fd3-c2257822dca3). Replaces the
    // previous listUsers({perPage: 1}) lookup which was non-deterministic
    // when auth.users had more than one row.
    const ownerId = process.env.OWNER_USER_ID;
    if (!ownerId) {
      console.error("Intake API: OWNER_USER_ID env var not set");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const rawBody = await request.json();
    const parsed = intakeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const payload: IntakePayload = parsed.data;

    // Honeypot spam check. Return a UUID-shaped id so any client parsing
    // `id` as a UUID does not blow up or accept a sentinel.
    if (payload.honeypot && payload.honeypot.length > 0) {
      return NextResponse.json({ id: randomUUID() }, { status: 201 });
    }

    const result = await processIntake(adminClient, payload, ownerId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof IntakeProcessingError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("Intake API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
