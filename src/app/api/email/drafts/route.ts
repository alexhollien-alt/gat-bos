// Phase 1.3.1 Phase 5 -- list active drafts for the /drafts dashboard.
// GET only. Auth: Supabase session (alex@alexhollienco.com) OR Bearer CRON_SECRET.
import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { verifyBearerOrSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ok = await verifyBearerOrSession(request);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const includeSent = url.searchParams.get("include_sent") === "true";
  const statuses = includeSent
    ? ["generated", "approved", "revised", "sent", "discarded"]
    : ["generated", "approved", "revised"];

  const { data, error } = await adminClient
    .from("email_drafts")
    .select(
      `id, email_id, draft_subject, draft_body_plain, draft_body_html, status,
       escalation_flag, escalation_reason, generated_at, expires_at, sent_at, sent_via,
       revisions_count, audit_log,
       email:emails!inner (
         id, gmail_id, gmail_thread_id, from_email, from_name, subject,
         body_plain, body_html, snippet, created_at, is_unread,
         is_contact_match, contact_id, contact_domain, is_potential_re_pro
       )`,
    )
    .in("status", statuses)
    .order("generated_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: `drafts load failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ drafts: data ?? [] });
}
