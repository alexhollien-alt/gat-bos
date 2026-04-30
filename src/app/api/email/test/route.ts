import { NextRequest, NextResponse } from "next/server";
import { sendDraft } from "@/lib/resend/client";
import { adminClient } from "@/lib/supabase/admin";
import {
  tenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenantFromRequest";

// Dev-only smoke test for Resend wiring. Returns 404 in production so the
// endpoint does not exist as far as external callers can tell, and so an
// attacker who discovers the URL cannot burn Resend quota by hammering it.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  let ctx;
  try {
    ctx = await tenantFromRequest(request);
  } catch (err) {
    if (err instanceof TenantResolutionError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    throw err;
  }
  if (ctx.kind !== "user") {
    return NextResponse.json(
      { ok: false, error: "user session required" },
      { status: 401 },
    );
  }

  const { data: userRecord, error: userErr } =
    await adminClient.auth.admin.getUserById(ctx.userId);
  const ownerEmail = userRecord?.user?.email;
  if (userErr || !ownerEmail) {
    return NextResponse.json(
      { ok: false, error: "owner email lookup failed" },
      { status: 500 },
    );
  }

  try {
    const data = await sendDraft({
      to: ownerEmail,
      subject: "Hello World",
      html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
