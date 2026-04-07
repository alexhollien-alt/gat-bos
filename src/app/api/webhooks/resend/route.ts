import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const SCORE_BUMPS: Record<string, number> = {
  "email.delivered": 1,
  "email.opened": 3,
  "email.clicked": 5,
};

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { type, data } = payload;

    if (!["email.delivered", "email.opened", "email.clicked"].includes(type)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const recipientEmail = data.to?.[0];
    if (!recipientEmail) return NextResponse.json({ ok: true, skipped: true });

    const { data: contact } = await supabase
      .from("contacts")
      .select("id, health_score, first_name, last_name, user_id")
      .eq("email", recipientEmail)
      .is("deleted_at", null)
      .single();

    if (!contact) return NextResponse.json({ ok: true, skipped: true, reason: "no matching contact" });

    const bump = SCORE_BUMPS[type] || 0;
    if (bump > 0) {
      await supabase
        .from("contacts")
        .update({ health_score: Math.min((contact.health_score || 0) + bump, 100) })
        .eq("id", contact.id);
    }

    if (type === "email.opened" || type === "email.clicked") {
      const summary = type === "email.opened"
        ? `Opened: ${data.subject}`
        : `Clicked link in: ${data.subject}`;

      await supabase.from("interactions").insert({
        user_id: contact.user_id,
        contact_id: contact.id,
        type: "email",
        summary,
        direction: "inbound",
      });
    }

    return NextResponse.json({ ok: true, contact_id: contact.id, bump });
  } catch {
    return NextResponse.json({ error: "webhook processing failed" }, { status: 500 });
  }
}
