// Phase 1.3.1 Gmail OAuth -- start consent flow.
// Visit this route in a browser while signed in to Google as alex@alexhollienco.com.
import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/gmail/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.ROLLBACK_GMAIL_SYNC === "true") {
    return NextResponse.json({ error: "Gmail sync disabled" }, { status: 503 });
  }
  try {
    const url = buildAuthorizeUrl();
    return NextResponse.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "authorize failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
