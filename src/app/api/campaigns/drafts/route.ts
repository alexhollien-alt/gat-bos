// Slice 8 Phase 4 -- /api/campaigns/drafts
// GET: list latest 25 campaign_drafts (auth required).
// PATCH: actions = approve | reject | edit_html. RLS enforces alex-only.

import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { writeEvent } from "@/lib/activity/writeEvent";
import { logError } from "@/lib/error-log";

export const dynamic = "force-dynamic";

const ROUTE = "/api/campaigns/drafts";

async function requireAlex() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return { user: null as never, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (user.email !== "alex@alexhollienco.com") {
    return { user: null as never, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, error: null as null };
}

async function resolveAccountOwnerId(): Promise<string | null> {
  const { data, error } = await adminClient
    .from("accounts")
    .select("owner_user_id")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    await logError(ROUTE, `accounts owner lookup failed: ${error.message}`, {});
    return null;
  }
  return data?.owner_user_id ?? null;
}

export async function GET(request: NextRequest) {
  const { user, error: authErr } = await requireAlex();
  if (authErr) return authErr;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 25), 100);

  const { data, error } = await adminClient
    .from("campaign_drafts")
    .select(
      "id, template_slug, template_version, week_of, recipient_list_slug, subject, body_html, body_text, status, approved_at, approved_by, rejected_at, rejected_reason, sent_at, send_summary, narrative_payload, created_at, updated_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: `campaign drafts load failed: ${error.message}` }, { status: 500 });
  }

  void user; // referenced by RLS but the SELECT goes through service role
  return NextResponse.json({ drafts: data ?? [] });
}

interface PatchBody {
  id?: string;
  action?: "approve" | "reject" | "edit_html";
  body_html?: string;
  rejected_reason?: string;
}

export async function PATCH(request: NextRequest) {
  const { user, error: authErr } = await requireAlex();
  if (authErr) return authErr;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id || !body.action) {
    return NextResponse.json({ error: "id and action required" }, { status: 400 });
  }

  const { data: existing, error: readErr } = await adminClient
    .from("campaign_drafts")
    .select("id, status")
    .eq("id", body.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: `draft read failed: ${readErr.message}` }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  if (existing.status !== "pending_review") {
    return NextResponse.json(
      { error: `Draft is in status '${existing.status}'; only 'pending_review' is editable` },
      { status: 409 },
    );
  }

  const ownerUserId = (await resolveAccountOwnerId()) ?? user.id;
  const nowIso = new Date().toISOString();

  if (body.action === "approve") {
    const { error: updateErr } = await adminClient
      .from("campaign_drafts")
      .update({
        status: "approved",
        approved_at: nowIso,
        approved_by: user.email,
        updated_at: nowIso,
      })
      .eq("id", body.id);
    if (updateErr) {
      return NextResponse.json({ error: `approve failed: ${updateErr.message}` }, { status: 500 });
    }
    await writeEvent({
      userId: ownerUserId,
      actorId: ownerUserId,
      verb: "campaign.draft_approved",
      object: { table: "campaign_drafts", id: body.id },
      context: { approved_by: user.email },
    });
    return NextResponse.json({ ok: true, id: body.id, status: "approved" });
  }

  if (body.action === "reject") {
    const { error: updateErr } = await adminClient
      .from("campaign_drafts")
      .update({
        status: "rejected",
        rejected_at: nowIso,
        rejected_reason: body.rejected_reason ?? null,
        updated_at: nowIso,
      })
      .eq("id", body.id);
    if (updateErr) {
      return NextResponse.json({ error: `reject failed: ${updateErr.message}` }, { status: 500 });
    }
    await writeEvent({
      userId: ownerUserId,
      actorId: ownerUserId,
      verb: "campaign.draft_rejected",
      object: { table: "campaign_drafts", id: body.id },
      context: { rejected_by: user.email, reason: body.rejected_reason ?? null },
    });
    return NextResponse.json({ ok: true, id: body.id, status: "rejected" });
  }

  if (body.action === "edit_html") {
    if (typeof body.body_html !== "string" || body.body_html.length === 0) {
      return NextResponse.json({ error: "body_html required for edit_html" }, { status: 400 });
    }
    const { error: updateErr } = await adminClient
      .from("campaign_drafts")
      .update({
        body_html: body.body_html,
        updated_at: nowIso,
      })
      .eq("id", body.id);
    if (updateErr) {
      return NextResponse.json({ error: `edit failed: ${updateErr.message}` }, { status: 500 });
    }
    await writeEvent({
      userId: ownerUserId,
      actorId: ownerUserId,
      verb: "campaign.draft_edited",
      object: { table: "campaign_drafts", id: body.id },
      context: { edited_by: user.email, body_html_length: body.body_html.length },
    });
    return NextResponse.json({ ok: true, id: body.id, status: "pending_review" });
  }

  return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
}
