// src/app/api/captures/cleanup-audio/route.ts
//
// Cleanup cron for captures-audio storage bucket.
// Deletes objects older than 30 days.
//
// Auth: Bearer CRON_SECRET (Vercel cron header).
// Runtime: Node (service-role client, no edge restrictions).
//
// NOTE: Wire to Vercel cron in vercel.json (see BLOCKERS.md).
// Bucket: captures-audio (private, 50MB limit, audio/* types).
//
// Failure path: 500 with error message.
// Success path: JSON { deleted: count }.

import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/api-auth";

export const runtime = "nodejs";

const BUCKET_ID = "captures-audio";
const RETENTION_DAYS = 30;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await adminClient
    .schema("storage")
    .from("objects")
    .delete()
    .eq("bucket_id", BUCKET_ID)
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const deleted = data?.length ?? 0;

  return NextResponse.json({ deleted, bucket: BUCKET_ID, cutoff });
}
