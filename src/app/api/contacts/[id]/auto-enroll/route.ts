// POST /api/contacts/[id]/auto-enroll
//
// Server endpoint invoked by the New Contact modal after a successful
// browser-side insert. The modal's anon-key client can't read the campaign
// row because campaigns is RLS-scoped to the auth user; the service-role
// adminClient used here bypasses that and runs the same auto-enroll helper
// the other contact-creation paths use.
//
// Fire-and-forget from the client: this endpoint always returns 200 JSON,
// even if enrollment was skipped, so a campaign-not-found (or a non-realtor
// contact) never surfaces as a UI error.

import { NextRequest, NextResponse } from "next/server";
import { firePostCreationHooks } from "@/lib/hooks/post-creation";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ownerId = process.env.OWNER_USER_ID;
  if (!ownerId) {
    return NextResponse.json(
      { error: "Server misconfigured: OWNER_USER_ID not set" },
      { status: 500 },
    );
  }

  // Slice 5B: route through the hook dispatcher. Runs auto-enroll +
  // welcome-task in isolation. The endpoint stays fire-and-forget from the
  // browser modal's perspective: always returns 200 ok even when handlers
  // skip (non-realtor, missing campaign, already-enrolled, etc.).
  await firePostCreationHooks({
    entityKind: "contact",
    entityId: params.id,
    payload: {},
    ownerUserId: ownerId,
  });
  return NextResponse.json({ ok: true });
}
