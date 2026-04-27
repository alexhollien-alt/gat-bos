/* eslint-disable no-restricted-syntax -- Inline hex colors and HTML
   numeric character references are required for email-rendered HTML.
   Email clients do not support CSS variables or external stylesheets;
   colors must be inlined per email-design conventions. The rule's
   regex also matches HTML entities like &#039; which are not hex
   colors. Scoped to this file only. */
// Slice 5B Task 7 -- Daily touchpoint reminder cron.
//
// Runs at 0 12 * * * UTC (5:00 AM MST in Phoenix, 30 minutes before
// /api/cron/morning-brief). Surfaces touchpoints + tasks due this week
// or overdue, capped at 50 rows, and emails Alex the daily summary.
//
// Auth: Bearer CRON_SECRET (verifyCronSecret).
// Recipient: production -> alex@alexhollienco.com.
//            non-production -> RESEND_SAFE_RECIPIENT (Resend sandbox safety).
// Re-trigger debounce: skip touchpoints whose last_reminded_at is
//   younger than 20 hours -- a manual mid-day re-fire of the same cron
//   should not double-email the same row.
// Tasks have no last_reminded_at column (Slice 5B did not add one), so
//   they are never debounced; same-day re-runs may include the same task
//   if the cron fires twice. Acceptable for v1 -- the cron runs once at
//   05:00 in production.

import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/api-auth";
import { logError } from "@/lib/error-log";
import { sendMessage } from "@/lib/messaging/send";
import { weeklyWhere } from "@/lib/touchpoints/weeklyWhere";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ROUTE = "/api/cron/touchpoint-reminder";
const ROW_CAP = 50;
const DEBOUNCE_HOURS = 20;
const TEMPLATE_SLUG = "daily-touchpoint-summary";
const PROD_RECIPIENT = "alex@alexhollienco.com";

interface TouchpointRow {
  id: string;
  project_id: string;
  touchpoint_type: string;
  due_at: string | null;
  note: string | null;
  last_reminded_at: string | null;
  projects: { title: string | null } | null;
}

interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  action_hint: string | null;
  project_id: string | null;
  contact_id: string | null;
}

interface SurfacedItem {
  kind: "touchpoint" | "task";
  id: string;
  due: string | null;
  title: string;
  detail: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDueLabel(iso: string | null, asOf: Date): string {
  if (!iso) return "no due date";
  const due = new Date(iso);
  const diffDays = Math.floor((due.getTime() - asOf.getTime()) / (24 * 60 * 60 * 1000));
  const dateStr = due.toLocaleDateString("en-US", {
    timeZone: "America/Phoenix",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (diffDays < -1) return `${dateStr} (${Math.abs(diffDays)}d overdue)`;
  if (diffDays === -1) return `${dateStr} (1d overdue)`;
  if (diffDays === 0) return `${dateStr} (today)`;
  if (diffDays === 1) return `${dateStr} (tomorrow)`;
  return `${dateStr} (in ${diffDays}d)`;
}

async function loadTouchpoints(endIso: string): Promise<TouchpointRow[]> {
  const debounceCutoff = new Date(
    Date.now() - DEBOUNCE_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await adminClient
    .from("project_touchpoints")
    .select("id, project_id, touchpoint_type, due_at, note, last_reminded_at, projects!inner(title)")
    .is("deleted_at", null)
    .is("occurred_at", null)
    .not("due_at", "is", null)
    .lte("due_at", endIso)
    .or(`last_reminded_at.is.null,last_reminded_at.lt.${debounceCutoff}`)
    .order("due_at", { ascending: true })
    .limit(ROW_CAP * 2);
  if (error) {
    await logError(ROUTE, `touchpoints query failed: ${error.message}`, {});
    return [];
  }
  return (data ?? []) as unknown as TouchpointRow[];
}

async function loadTasks(endIso: string): Promise<TaskRow[]> {
  const { data, error } = await adminClient
    .from("tasks")
    .select("id, title, due_date, status, action_hint, project_id, contact_id")
    .is("deleted_at", null)
    .not("status", "in", "(done,cancelled)")
    .not("due_date", "is", null)
    .lte("due_date", endIso)
    .order("due_date", { ascending: true })
    .limit(ROW_CAP * 2);
  if (error) {
    await logError(ROUTE, `tasks query failed: ${error.message}`, {});
    return [];
  }
  return (data ?? []) as TaskRow[];
}

async function handleRun(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const startedAt = Date.now();
  const asOf = new Date();
  const { endIso } = weeklyWhere({ asOf });

  const [touchpoints, tasks] = await Promise.all([
    loadTouchpoints(endIso),
    loadTasks(endIso),
  ]);

  const items: SurfacedItem[] = [
    ...touchpoints.map<SurfacedItem>((t) => ({
      kind: "touchpoint",
      id: t.id,
      due: t.due_at,
      title: t.projects?.title ?? `(project ${t.project_id.slice(0, 8)})`,
      detail: t.note ?? t.touchpoint_type,
    })),
    ...tasks.map<SurfacedItem>((t) => ({
      kind: "task",
      id: t.id,
      due: t.due_date,
      title: t.title,
      detail: t.action_hint ?? null,
    })),
  ].sort((a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due.localeCompare(b.due);
  });

  const totalAvailable = items.length;
  if (totalAvailable === 0) {
    return NextResponse.json({
      ok: true,
      sent: false,
      reason: "no_items_due",
      durationMs: Date.now() - startedAt,
    });
  }

  const surfaced = items.slice(0, ROW_CAP);
  const overflow = totalAvailable - surfaced.length;

  const rowsHtml = surfaced
    .map((item) => {
      const kindLabel = item.kind === "touchpoint" ? "Touchpoint" : "Task";
      const dueLabel = formatDueLabel(item.due, asOf);
      const detailLine = item.detail
        ? `<br><span style="color:#666666;font-size:13px;">${escapeHtml(item.detail)}</span>`
        : "";
      return `<li><strong>${escapeHtml(item.title)}</strong> &middot; <span style="color:#666666;">${kindLabel} &middot; ${escapeHtml(dueLabel)}</span>${detailLine}</li>`;
    })
    .join("\n    ");

  const rowsText = surfaced
    .map((item) => {
      const kindLabel = item.kind === "touchpoint" ? "Touchpoint" : "Task";
      const dueLabel = formatDueLabel(item.due, asOf);
      const detailLine = item.detail ? `\n    ${item.detail}` : "";
      return `- ${item.title} (${kindLabel} -- ${dueLabel})${detailLine}`;
    })
    .join("\n");

  const overflowText =
    overflow > 0
      ? `Plus ${overflow} more item${overflow === 1 ? "" : "s"} not shown.`
      : "";

  const dateLabel = asOf.toLocaleDateString("en-US", {
    timeZone: "America/Phoenix",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const recipient =
    process.env.NODE_ENV === "production"
      ? PROD_RECIPIENT
      : process.env.RESEND_SAFE_RECIPIENT ?? PROD_RECIPIENT;

  let sendResult: Awaited<ReturnType<typeof sendMessage>> | null = null;
  try {
    sendResult = await sendMessage({
      templateSlug: TEMPLATE_SLUG,
      recipient,
      mode: "resend",
      variables: {
        date: dateLabel,
        count_total: String(totalAvailable),
        rows_html: rowsHtml,
        rows_text: rowsText,
        overflow_count: overflowText,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logError(ROUTE, `sendMessage threw: ${message}`, {
      surfaced: surfaced.length,
      total: totalAvailable,
    });
    return NextResponse.json(
      { ok: false, error: message, surfaced: surfaced.length, total: totalAvailable },
      { status: 500 },
    );
  }

  // Bump last_reminded_at on the touchpoint rows we surfaced so the next
  // run inside the debounce window skips them. Tasks are not updated
  // (no column). Best-effort -- failure here doesn't fail the cron.
  const surfacedTouchpointIds = surfaced
    .filter((item) => item.kind === "touchpoint")
    .map((item) => item.id);
  if (surfacedTouchpointIds.length > 0) {
    const { error: stampErr } = await adminClient
      .from("project_touchpoints")
      .update({ last_reminded_at: new Date().toISOString() })
      .in("id", surfacedTouchpointIds);
    if (stampErr) {
      await logError(ROUTE, `last_reminded_at stamp failed: ${stampErr.message}`, {
        touchpoint_count: surfacedTouchpointIds.length,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    surfaced: surfaced.length,
    total: totalAvailable,
    overflow,
    logId: sendResult.logId,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await handleRun(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "touchpoint-reminder failed";
    await logError(ROUTE, `unhandled: ${message}`, {});
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
