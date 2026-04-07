// src/lib/api-auth.ts
// Bearer-token gate for internal API routes. Skills and other trusted
// callers must send `Authorization: Bearer <INTERNAL_API_TOKEN>`.
// Browser code should not call these routes; it queries Supabase directly.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const TOKEN = process.env.INTERNAL_API_TOKEN;

/**
 * Returns a 401 NextResponse if the request lacks a valid bearer token.
 * Returns null if the request is authorized -- caller proceeds.
 *
 * Usage:
 *   export async function GET(request: NextRequest) {
 *     const unauth = requireApiToken(request);
 *     if (unauth) return unauth;
 *     // ... rest of handler
 *   }
 */
export function requireApiToken(request: Request): NextResponse | null {
  if (!TOKEN) {
    // Server is misconfigured. Fail closed.
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
  // Length check first -- timingSafeEqual throws on mismatched lengths.
  if (provided.length !== TOKEN.length) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = timingSafeEqual(Buffer.from(provided), Buffer.from(TOKEN));
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
