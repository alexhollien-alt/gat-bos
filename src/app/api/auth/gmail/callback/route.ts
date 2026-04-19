// Phase 1.3.1 Gmail OAuth -- callback handler.
// Verifies HMAC state, exchanges code for tokens, encrypts and stores refresh_token.
import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, saveTokens, verifyState } from "@/lib/gmail/oauth";

export const dynamic = "force-dynamic";

function redirectTo(req: NextRequest, path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  return NextResponse.redirect(new URL(path, base));
}

export async function GET(req: NextRequest) {
  if (process.env.ROLLBACK_GMAIL_SYNC === "true") {
    return NextResponse.json({ error: "Gmail sync disabled" }, { status: 503 });
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return redirectTo(req, `/inbox?gmail_auth=denied&reason=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }
  if (!verifyState(state)) {
    return NextResponse.json({ error: "Invalid or expired state" }, { status: 400 });
  }

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) {
      return redirectTo(req, "/inbox?gmail_auth=no_refresh");
    }
    await saveTokens(tokens);
    return redirectTo(req, "/inbox?gmail_auth=ok");
  } catch (err) {
    const message = err instanceof Error ? err.message : "callback failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
