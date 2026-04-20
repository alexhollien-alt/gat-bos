// Phase 1.3.1 Gmail sync -- fetches unread, filters to contacts/domains, upserts to emails table.
// GET: cron (requires Bearer CRON_SECRET). POST: manual trigger.
// Fire-and-forget trigger to /api/email/generate-draft (Phase 4) for each included email.
import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { fetchMessage, listUnreadSince } from "@/lib/gmail/sync-client";
import { classifyEmail, extractDomain } from "@/lib/gmail/filter";
import { verifyCronSecret } from "@/lib/api-auth";
import { logError } from "@/lib/error-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_SINCE_HOURS = 4;

interface ContactRow {
  id: string;
  email: string | null;
}

async function loadContactMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data, error } = await adminClient
    .from("contacts")
    .select("id, email")
    .not("email", "is", null);
  if (error) throw new Error(`contacts read failed: ${error.message}`);
  for (const row of (data ?? []) as ContactRow[]) {
    if (row.email) map.set(row.email.trim().toLowerCase(), row.id);
  }
  return map;
}

const ROUTE = "/api/gmail/sync";

function triggerDraftGeneration(emailId: string, origin: string) {
  if (process.env.ROLLBACK_DRAFT_GEN === "true") return;
  const url = `${origin}/api/email/generate-draft`;
  fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`,
    },
    body: JSON.stringify({ email_id: emailId }),
  }).catch(() => {
    // Phase 4 not yet built -- swallow ECONNREFUSED / 404.
  });
}

async function runSync(req: NextRequest, sinceHours: number) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const contactMap = await loadContactMap();
  const ids = await listUnreadSince(sinceHours);

  let scanned = 0;
  let included = 0;
  let skipped = 0;
  const reasons: Record<string, number> = {};

  for (const id of ids) {
    scanned++;
    try {
      const msg = await fetchMessage(id);
      if (!msg) {
        skipped++;
        reasons["fetch_empty"] = (reasons["fetch_empty"] ?? 0) + 1;
        continue;
      }

      const verdict = classifyEmail({
        fromEmail: msg.fromEmail,
        fromName: msg.fromName,
        bodyPlain: msg.bodyPlain,
        subject: msg.subject,
        contactIdByEmail: contactMap,
      });

      if (!verdict.include) {
        skipped++;
        reasons[verdict.reason] = (reasons[verdict.reason] ?? 0) + 1;
        continue;
      }

      const isContactMatch = verdict.reason === "contact_match";
      const contactId = isContactMatch ? verdict.contactId : null;
      const isPotentialRePro = verdict.reason === "domain_match";
      const domain = extractDomain(msg.fromEmail);
      const nowIso = new Date().toISOString();

      const { data: upserted, error: upsertErr } = await adminClient
        .from("emails")
        .upsert(
          {
            gmail_id: msg.gmailId,
            gmail_thread_id: msg.threadId,
            from_email: msg.fromEmail,
            from_name: msg.fromName,
            subject: msg.subject,
            body_plain: msg.bodyPlain,
            body_html: msg.bodyHtml,
            snippet: msg.snippet,
            labels: msg.labels,
            created_at: msg.receivedAt.toISOString(),
            is_unread: msg.isUnread,
            is_contact_match: isContactMatch,
            contact_id: contactId,
            contact_domain: domain,
            is_potential_re_pro: isPotentialRePro,
            synced_at: nowIso,
            last_checked_at: nowIso,
          },
          { onConflict: "gmail_id" },
        )
        .select("id")
        .single();

      if (upsertErr) {
        skipped++;
        reasons["upsert_error"] = (reasons["upsert_error"] ?? 0) + 1;
        await logError(ROUTE, `emails upsert failed: ${upsertErr.message}`, {
          gmail_id: msg.gmailId,
        });
        continue;
      }

      included++;
      if (upserted?.id) triggerDraftGeneration(upserted.id, origin);
    } catch (err) {
      skipped++;
      reasons["exception"] = (reasons["exception"] ?? 0) + 1;
      await logError(
        ROUTE,
        `sync loop exception: ${err instanceof Error ? err.message : String(err)}`,
        { gmail_id: id },
      );
    }
  }

  return { scanned, included, skipped, reasons, since_hours: sinceHours };
}

export async function GET(request: NextRequest) {
  if (process.env.ROLLBACK_GMAIL_SYNC === "true") {
    return NextResponse.json({ error: "Gmail sync disabled" }, { status: 503 });
  }
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const hoursParam = request.nextUrl.searchParams.get("hours");
    const sinceHours = hoursParam ? Number(hoursParam) : DEFAULT_SINCE_HOURS;
    const result = await runSync(
      request,
      Number.isFinite(sinceHours) && sinceHours > 0 ? sinceHours : DEFAULT_SINCE_HOURS,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    await logError(ROUTE, `sync entry failed: ${message}`, {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (process.env.ROLLBACK_GMAIL_SYNC === "true") {
    return NextResponse.json({ error: "Gmail sync disabled" }, { status: 503 });
  }
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { hours?: number };
    const sinceHours =
      typeof body.hours === "number" && body.hours > 0 ? body.hours : DEFAULT_SINCE_HOURS;
    const result = await runSync(request, sinceHours);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    await logError(ROUTE, `sync entry failed: ${message}`, {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
