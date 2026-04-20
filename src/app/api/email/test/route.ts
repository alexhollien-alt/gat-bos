import { NextResponse } from "next/server";
import { sendDraft } from "@/lib/resend/client";
import { ALEX_EMAIL } from "@/lib/constants";

// Dev-only smoke test for Resend wiring. Returns 404 in production so the
// endpoint does not exist as far as external callers can tell, and so an
// attacker who discovers the URL cannot burn Resend quota by hammering it.
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const data = await sendDraft({
      to: ALEX_EMAIL,
      subject: "Hello World",
      html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
