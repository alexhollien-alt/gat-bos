import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";

export async function POST() {
  try {
    const data = await sendEmail({
      to: "alex@alexhollienco.com",
      subject: "Hello World",
      html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
