import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sendDraft } from "@/lib/resend/client";

// Dedicated test-send for the Berneil broker-open email.
// Reads /public/email-drafts/berneil-broker-open.html at request time, ships
// it via Resend to a fixed test recipient. Replaces the deprecated Gmail
// draft flow (Gmail rewrites parts of the HTML, harming fidelity).
//
// Auth: shared secret in the `secret` query string, compared to env
// BERNEIL_TEST_SECRET. Cheap, sufficient for a one-recipient internal route.
// If the secret env is unset, the route always 404s.

const RECIPIENT = "ahollien@azgat.com";
const SUBJECT = "Broker Open at 4901 East Berneil Drive";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secretEnv = process.env.BERNEIL_TEST_SECRET?.trim();
  if (!secretEnv) {
    return new NextResponse(null, { status: 404 });
  }
  const provided = new URL(request.url).searchParams.get("secret");
  if (provided !== secretEnv) {
    return new NextResponse(null, { status: 404 });
  }

  let html: string;
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "email-drafts",
      "berneil-broker-open.html",
    );
    html = await readFile(filePath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : "read failed";
    return NextResponse.json(
      { ok: false, error: `email html load failed: ${message}` },
      { status: 500 },
    );
  }

  try {
    const result = await sendDraft({
      to: RECIPIENT,
      subject: SUBJECT,
      html,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "send failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
