// Slice 7C / Task 5d -- GET /portal/redeem
//
// Magic-link landing route. The agent clicks the redeem URL embedded in the
// portal-invite email (issued by /api/portal/invite, Task 5a):
//
//   https://<origin>/portal/redeem?token=<plaintext-base64url>
//
// Per OQ#3 (b): the redeem RPC validates only -- it consumes the invite and
// returns email/slug, but does NOT mint a session. This route is responsible
// for handing off to Supabase Auth's hosted callback so the agent ends up
// with a real session cookie. We use admin.auth.admin.generateLink({
// type: 'magiclink' }) which:
//   - creates the auth.users row if the email is new (first-time portal
//     onboarding flow); subsequent /portal/[slug]/login signInWithOtp calls
//     find the existing user and skip the shouldCreateUser=false guard
//   - returns a properties.action_link that, when followed, completes the
//     OTP exchange and drops the agent at the redirectTo destination
//
// Per OQ#4: token is sha256-hashed in Node before invoking the RPC. The
// plaintext never touches the database server.
//
// Public route. Middleware (Task 6) bypasses /portal/redeem from auth.

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RedeemRow = {
  email: string;
  slug: string;
  account_id: string;
  contact_id: string;
};

function errorResponse(status: number, code: string, detail?: string) {
  const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Sign-in link unavailable</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      body { margin: 0; background: #09090b; color: #f4f4f5; font-family: ui-sans-serif, system-ui, sans-serif; min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; }
      .card { max-width: 28rem; border: 1px solid #27272a; background: #18181b; border-radius: 0.5rem; padding: 2.5rem 1.75rem; }
      h1 { margin: 0 0 0.75rem; font-size: 1.5rem; font-weight: 600; letter-spacing: -0.01em; }
      p { margin: 0.5rem 0 0; line-height: 1.6; color: #a1a1aa; font-size: 0.9rem; }
      code { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 0.7rem; letter-spacing: 0.18em; color: #71717a; text-transform: uppercase; display: block; margin-top: 1.5rem; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Sign-in link unavailable</h1>
      <p>This sign-in link is invalid, expired, or has already been used. Each link works only once.</p>
      <p>Contact Alex Hollien at Great American Title Agency to request a new invitation.</p>
      <code>Error &middot; ${code}${detail ? ` &middot; ${detail}` : ""}</code>
    </main>
  </body>
</html>`;
  return new NextResponse(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const tokenPlaintext = request.nextUrl.searchParams.get("token");
  if (!tokenPlaintext || tokenPlaintext.length < 16) {
    return errorResponse(400, "missing_token");
  }

  const tokenHash = createHash("sha256").update(tokenPlaintext).digest("hex");

  // Anon client invokes the RPC. Service role would also work but anon
  // exercises the same code path the RPC's GRANT EXECUTE TO anon serves,
  // matching how the link behaves for an unauthenticated visitor.
  const anon = createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: redeemed, error: rpcErr } = await anon.rpc(
    "redeem_agent_invite",
    { p_token_hash: tokenHash },
  );

  if (rpcErr) {
    // P0002 from the RPC means invalid/expired/already-redeemed. Any other
    // error is an infrastructure miss (RPC missing, role lost EXECUTE).
    const code = rpcErr.code === "P0002" ? "invite_unredeemable" : "rpc_failed";
    const status = rpcErr.code === "P0002" ? 410 : 500;
    return errorResponse(status, code);
  }

  const row = Array.isArray(redeemed) ? (redeemed[0] as RedeemRow | undefined) : undefined;
  if (!row?.email || !row?.slug) {
    return errorResponse(410, "invite_unredeemable");
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const redirectTo = `${origin.replace(/\/+$/, "")}/portal/${row.slug}/dashboard`;

  // Hand off to Supabase Auth. generateLink creates the auth.users row if
  // missing (first-time onboarding) and returns an action_link that, when
  // followed, completes the OTP exchange and lands the agent at redirectTo
  // with a session cookie set by Supabase's hosted callback.
  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: row.email,
    options: { redirectTo },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    return errorResponse(502, "auth_link_failed");
  }

  return NextResponse.redirect(linkData.properties.action_link, { status: 302 });
}
