// Slice 8 Phase 4 -- Weekly Edge assembly cron.
//
// Schedule (registered in Phase 5): 0 18 * * 2 UTC (Tue 11 AM PHX, MST
// year-round). Manual trigger: GET with Bearer CRON_SECRET.
//
// Flow:
//   1. Auth (Bearer CRON_SECRET).
//   2. Resolve current ISO Monday as week_of.
//   3. Idempotency: if a campaign_drafts row exists for (week_of,
//      'weekly-edge') with status NOT IN ('rejected'), return 200 + skipped.
//   4. Fetch latest weekly_snapshot rows per tracked market for this week_of.
//   5. For each market, run runWeeklyEdgeWriter() to produce the narrative.
//   6. renderWeeklyEdge() composes subject + body_html + body_text against
//      the seeded weekly-edge template.
//   7. Insert one campaign_drafts row, status='pending_review'.
//   8. Emit activity_events 'campaign.draft_created'.

import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/api-auth";
import { logError } from "@/lib/error-log";
import { writeEvent } from "@/lib/activity/writeEvent";
import { TRACKED_MARKETS } from "@/lib/markets/tracked";
import {
  runWeeklyEdgeWriter,
  type WeeklySnapshotRow,
} from "@/lib/ai/weekly-edge-writer";
import {
  renderWeeklyEdge,
  deriveIssueNumber,
  type MarketRender,
} from "@/lib/campaigns/render-weekly-edge";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ROUTE = "/api/cron/weekly-edge-assemble";
const TEMPLATE_SLUG = "weekly-edge";
const RECIPIENT_LIST_SLUG = "agents-active";

function mondayOfIsoWeek(asOf: Date): string {
  const d = new Date(asOf);
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  const diff = (dow === 0 ? -6 : 1) - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
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

async function fetchSnapshotsForWeek(weekOf: string): Promise<WeeklySnapshotRow[]> {
  const slugs = TRACKED_MARKETS.map((m) => m.slug);
  const { data, error } = await adminClient
    .from("weekly_snapshot")
    .select("week_of, market_slug, market_label, data, narrative_seed")
    .eq("week_of", weekOf)
    .in("market_slug", slugs)
    .is("deleted_at", null);
  if (error) {
    throw new Error(`weekly_snapshot read failed: ${error.message}`);
  }
  return (data ?? []).map((row) => ({
    week_of: row.week_of as string,
    market_slug: row.market_slug as string,
    market_label: row.market_label as string,
    data: (row.data ?? {}) as Record<string, unknown>,
    narrative_seed: (row.narrative_seed ?? null) as string | null,
  }));
}

async function existingActiveDraft(weekOf: string): Promise<{ id: string } | null> {
  const { data, error } = await adminClient
    .from("campaign_drafts")
    .select("id, status")
    .eq("week_of", weekOf)
    .eq("template_slug", TEMPLATE_SLUG)
    .is("deleted_at", null)
    .neq("status", "rejected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`campaign_drafts read failed: ${error.message}`);
  }
  return data ? { id: data.id as string } : null;
}

async function handleRun(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const weekOf = mondayOfIsoWeek(new Date());
  const ownerUserId = await resolveAccountOwnerId();

  if (!ownerUserId) {
    await logError(ROUTE, "no account row found; cannot proceed", { week_of: weekOf });
    return NextResponse.json(
      { error: "No account configured" },
      { status: 500 },
    );
  }

  const existing = await existingActiveDraft(weekOf);
  if (existing) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "active draft already exists for week",
      draft_id: existing.id,
      week_of: weekOf,
      durationMs: Date.now() - startedAt,
    });
  }

  const snapshots = await fetchSnapshotsForWeek(weekOf);
  if (snapshots.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "No weekly_snapshot rows for current week. Run /api/cron/altos-pull first.",
        week_of: weekOf,
      },
      { status: 412 },
    );
  }

  const markets: MarketRender[] = [];
  for (const snapshot of snapshots) {
    const result = await runWeeklyEdgeWriter({
      snapshot,
      userId: ownerUserId,
    });
    markets.push({
      snapshot,
      narrative: result.narrative,
      pending_credentials: result.pending_credentials,
    });
  }

  const issueNumber = deriveIssueNumber(weekOf);
  const rendered = await renderWeeklyEdge({
    weekOf,
    issueNumber,
    markets,
  });

  const narrativePayload = {
    issue_number: issueNumber,
    markets: markets.map((m) => ({
      market_slug: m.snapshot.market_slug,
      market_label: m.snapshot.market_label,
      pending_credentials: m.pending_credentials,
      narrative: m.narrative,
    })),
  };

  const { data: draft, error: insertErr } = await adminClient
    .from("campaign_drafts")
    .insert({
      template_slug: rendered.templateSlug,
      template_version: rendered.templateVersion,
      week_of: weekOf,
      recipient_list_slug: RECIPIENT_LIST_SLUG,
      subject: rendered.subject,
      body_html: rendered.body_html,
      body_text: rendered.body_text,
      narrative_payload: narrativePayload,
      variables: rendered.variables,
      status: "pending_review",
    })
    .select("id")
    .single();

  if (insertErr || !draft) {
    await logError(ROUTE, `campaign_drafts insert failed: ${insertErr?.message ?? "unknown"}`, {
      week_of: weekOf,
    });
    return NextResponse.json(
      { error: "draft insert failed" },
      { status: 500 },
    );
  }

  await writeEvent({
    userId: ownerUserId,
    actorId: ownerUserId,
    verb: "campaign.draft_created",
    object: { table: "campaign_drafts", id: draft.id },
    context: {
      week_of: weekOf,
      template_slug: rendered.templateSlug,
      template_version: rendered.templateVersion,
      recipient_list_slug: RECIPIENT_LIST_SLUG,
      market_count: markets.length,
      pending_credentials_count: markets.filter((m) => m.pending_credentials).length,
      unresolved_html: rendered.unresolved_html,
    },
  });

  return NextResponse.json({
    ok: true,
    draft_id: draft.id,
    week_of: weekOf,
    issue_number: issueNumber,
    template_slug: rendered.templateSlug,
    template_version: rendered.templateVersion,
    market_count: markets.length,
    unresolved_html: rendered.unresolved_html,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await handleRun(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "weekly-edge-assemble failed";
    await logError(ROUTE, `unhandled: ${message}`, {});
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
