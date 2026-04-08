// src/app/api/spine/parse/[inboxId]/route.ts
// Triggers the parser for a specific inbox entry. Used for retry and
// by Claude Code skill for inline parse. Real parser logic lives in
// src/lib/spine/parser.ts (Task 12).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiToken } from "@/lib/api-auth";
import { parseInboxEntry } from "@/lib/spine/parser";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { inboxId: string } }
) {
  // Allow both session and bearer token.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const unauth = requireApiToken(request);
    if (unauth) return unauth;
  }

  const { inboxId } = params;
  const result = await parseInboxEntry(inboxId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ parsed: result.data });
}
