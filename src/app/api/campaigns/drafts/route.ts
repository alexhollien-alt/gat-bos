// Slice 8 Phase 4 -- /api/campaigns/drafts
// GET: list latest 25 campaign_drafts (auth required).
// PATCH: actions = approve | reject | edit_html. RLS enforces alex-only.
//
// 2026-05-03 v1.0 readiness cleanup: requireAlex() (hardcoded email gate)
// replaced with tenantFromRequest(). Single-tenant gating happens at the
// resolver -- only the user who owns an account (Alex) resolves to
// kind === "user". Portal users have no owned account and fail with
// no_account. Multi-tenant scoping for campaign_drafts is deferred until
// Slice 8 goes multi-tenant (see migration 20260503023122 comment).

import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import {
  tenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenantFromRequest";
import { writeEvent } from "@/lib/activity/writeEvent";
import { logError } from "@/lib/error-log";

export const dynamic = "force-dynamic";

const ROUTE = "/api/campaigns/drafts";

interface ResolvedSession {
  userId: string;
  email: string;
}

async function resolveSession(
  request: NextRequest,
): Promise<
  | { session: ResolvedSession; error: null }
  | { session: null; error: NextResponse }
> {
  let ctx;
  try {
    ctx = await tenantFromRequest(request);
  } catch (err) {
    if (err instanceof TenantResolutionError) {
      return {
        session: null,
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    throw err;
  }
  if (ctx.kind !== "user") {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: userRecord, error: userErr } =
    await adminClient.auth.admin.getUserById(ctx.userId);
  const email = userRecord?.user?.email;
  if (userErr || !email) {
    await logError(ROUTE, `owner email lookup failed: ${userErr?.message ?? "no email"}`, {
      user_id: ctx.userId,
    });
    return {
      session: null,
      error: NextResponse.json({ error: "Owner email lookup failed" }, { status: 500 }),
    };
  }

  return { session: { userId: ctx.userId, email }, error: null };
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
  const { session, error: authErr } = await resolveSession(request);
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

  void session; // referenced by RLS but the SELECT goes through service role
  return NextResponse.json({ drafts: data ?? [] });
}

interface PatchBody {
  id?: string;
  action?: "approve" | "reject" | "edit_html";
  body_html?: string;
  rejected_reason?: string;
}

export async function PATCH(request: NextRequest) {
  const { session, error: authErr } = await resolveSession(request);
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

  const ownerUserId = (await resolveAccountOwnerId()) ?? session.userId;
  const nowIso = new Date().toISOString();

  if (body.action === "approve") {
    // Path A: .select("id") returns the rows actually written so we can
    // distinguish RLS-silent 0-row UPDATEs from real success. Gate 14 silent
    // failure (BLOCKERS 2026-05-03) was a 0-row match returning no error.
    const { data: updated, error: updateErr } = await adminClient
      .from("campaign_drafts")
      .update({
        status: "approved",
        approved_at: nowIso,
        approved_by: session.email,
        updated_at: nowIso,
      })
      .eq("id", body.id)
      .select("id");
    if (updateErr) {
      await logError(ROUTE, `approve update error: ${updateErr.message}`, {
        draft_id: body.id,
        action: "approve",
        actor: session.email,
      });
      return NextResponse.json({ error: `approve failed: ${updateErr.message}` }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      await logError(ROUTE, "approve update matched 0 rows", {
        draft_id: body.id,
        action: "approve",
        actor: session.email,
        prior_status: existing.status,
      });
      return NextResponse.json(
        { error: "Approve matched no rows; draft may have changed status concurrently" },
        { status: 409 },
      );
    }
    await writeEvent({
      userId: ownerUserId,
      actorId: ownerUserId,
      verb: "campaign.draft_approved",
      object: { table: "campaign_drafts", id: body.id },
      context: { approved_by: session.email },
    });
    return NextResponse.json({ ok: true, id: body.id, status: "approved" });
  }

  if (body.action === "reject") {
    const { data: updated, error: updateErr } = await adminClient
      .from("campaign_drafts")
      .update({
        status: "rejected",
        rejected_at: nowIso,
        rejected_reason: body.rejected_reason ?? null,
        updated_at: nowIso,
      })
      .eq("id", body.id)
      .select("id");
    if (updateErr) {
      await logError(ROUTE, `reject update error: ${updateErr.message}`, {
        draft_id: body.id,
        action: "reject",
        actor: session.email,
      });
      return NextResponse.json({ error: `reject failed: ${updateErr.message}` }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      await logError(ROUTE, "reject update matched 0 rows", {
        draft_id: body.id,
        action: "reject",
        actor: session.email,
        prior_status: existing.status,
      });
      return NextResponse.json(
        { error: "Reject matched no rows; draft may have changed status concurrently" },
        { status: 409 },
      );
    }
    await writeEvent({
      userId: ownerUserId,
      actorId: ownerUserId,
      verb: "campaign.draft_rejected",
      object: { table: "campaign_drafts", id: body.id },
      context: { rejected_by: session.email, reason: body.rejected_reason ?? null },
    });
    return NextResponse.json({ ok: true, id: body.id, status: "rejected" });
  }

  if (body.action === "edit_html") {
    if (typeof body.body_html !== "string" || body.body_html.length === 0) {
      return NextResponse.json({ error: "body_html required for edit_html" }, { status: 400 });
    }
    const { data: updated, error: updateErr } = await adminClient
      .from("campaign_drafts")
      .update({
        body_html: body.body_html,
        updated_at: nowIso,
      })
      .eq("id", body.id)
      .select("id");
    if (updateErr) {
      await logError(ROUTE, `edit_html update error: ${updateErr.message}`, {
        draft_id: body.id,
        action: "edit_html",
        actor: session.email,
        body_html_length: body.body_html.length,
      });
      return NextResponse.json({ error: `edit failed: ${updateErr.message}` }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      await logError(ROUTE, "edit_html update matched 0 rows", {
        draft_id: body.id,
        action: "edit_html",
        actor: session.email,
        prior_status: existing.status,
      });
      return NextResponse.json(
        { error: "Edit matched no rows; draft may have changed status concurrently" },
        { status: 409 },
      );
    }
    await writeEvent({
      userId: ownerUserId,
      actorId: ownerUserId,
      verb: "campaign.draft_edited",
      object: { table: "campaign_drafts", id: body.id },
      context: { edited_by: session.email, body_html_length: body.body_html.length },
    });
    return NextResponse.json({ ok: true, id: body.id, status: "pending_review" });
  }

  return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
}
