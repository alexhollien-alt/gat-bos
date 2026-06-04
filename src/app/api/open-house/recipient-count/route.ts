// GET /api/open-house/recipient-count?city=Scottsdale
// Live recipient count for the intake form. Authed (owner session).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMatchedAudience } from "@/lib/open-house/recipients";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const city = new URL(req.url).searchParams.get("city") ?? "";
  const audience = await getMatchedAudience({ userId: user.id, city });

  return NextResponse.json({
    city: audience.city,
    count: audience.count, // mailable (what the form shows)
    suppressed: audience.excluded.length,
    total: audience.total,
  });
}
