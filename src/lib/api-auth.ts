// src/lib/api-auth.ts
// Auth helpers for internal API routes.
//
// requireApiToken -- Bearer INTERNAL_API_TOKEN gate. Returns NextResponse 401
//   (or 500 if misconfigured) on failure, null on success. Used by
//   skill/integration callers.
//
// verifyCronSecret -- Bearer CRON_SECRET check. Returns boolean; callers choose
//   their own 401 response shape. Used by Vercel cron + manual route triggers.
//
// verifySession -- Supabase session gate; true iff a Supabase user is signed
//   in. Tenant scoping lives in tenantFromRequest + RLS, not here.
//
// verifyBearerOrSession -- combined cron OR session check for dual-auth routes.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

const TOKEN = process.env.INTERNAL_API_TOKEN;

export function requireApiToken(request: Request): NextResponse | null {
  if (!TOKEN) {
    return NextResponse.json(
      { error: "Server misconfigured: INTERNAL_API_TOKEN not set" },
      { status: 500 }
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/);
  if (!match) {
    return NextResponse.json(
      { error: "Missing or malformed Authorization header" },
      { status: 401 }
    );
  }

  const provided = match[1];
  if (provided.length !== TOKEN.length) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = timingSafeEqual(Buffer.from(provided), Buffer.from(TOKEN));
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (auth.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function verifySession(): Promise<boolean> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user != null;
  } catch {
    return false;
  }
}

export async function verifyBearerOrSession(request: Request): Promise<boolean> {
  if (verifyCronSecret(request)) return true;
  return verifySession();
}
