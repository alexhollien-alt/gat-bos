// src/app/api/inbox/scan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchUnreadThreads } from "@/lib/gmail/sync-client";
import { scoreThread } from "@/lib/inbox/scorer";
import { verifyCronSecret } from "@/lib/api-auth";
import { logError } from "@/lib/error-log";

const ROUTE = "/api/inbox/scan";

// Service-role client -- bypasses RLS so the cron can write for any user
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = process.env.GOOGLE_USER_EMAIL;
  if (!userEmail) {
    return NextResponse.json({ error: "GOOGLE_USER_EMAIL not configured" }, { status: 500 });
  }

  // Resolve Alex's Supabase user ID from his email.
  // @supabase/auth-js in this project does not expose getUserByEmail;
  // listUsers with perPage:1 and a server-side filter is the safe equivalent.
  const { data: authUsers, error: userErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const matched = authUsers?.users?.find((u) => u.email === userEmail);
  if (userErr || !matched) {
    await logError(
      ROUTE,
      `user lookup failed: ${userErr?.message ?? "no user matched"}`,
      { email: userEmail },
    );
    return NextResponse.json(
      { error: `No Supabase user found for ${userEmail}` },
      { status: 500 }
    );
  }
  const user = matched;

  let threads;
  try {
    threads = await fetchUnreadThreads(50);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gmail fetch failed";
    await logError(ROUTE, `gmail fetch failed: ${msg}`, {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (threads.length === 0) {
    return NextResponse.json({ scanned: 0, surfaced: 0, skipped: 0 });
  }

  // Batch-check which sender emails match known contacts
  const senderEmails = Array.from(new Set(threads.map((t) => t.senderEmail.toLowerCase())));
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, email, first_name, last_name, tier")
    .in("email", senderEmails)
    .is("deleted_at", null);

  const contactByEmail = new Map(
    (contacts ?? []).map((c) => [c.email?.toLowerCase() ?? "", c])
  );

  // Skip threads already scored -- idempotent, never re-score
  const threadIds = threads.map((t) => t.threadId);
  const { data: existing } = await supabase
    .from("inbox_items")
    .select("gmail_thread_id")
    .eq("user_id", user.id)
    .in("gmail_thread_id", threadIds);

  const existingIds = new Set((existing ?? []).map((r) => r.gmail_thread_id));

  let surfaced = 0;
  let skipped = 0;

  for (const thread of threads) {
    if (existingIds.has(thread.threadId)) {
      skipped++;
      continue;
    }

    const contact = contactByEmail.get(thread.senderEmail.toLowerCase());

    const result = await scoreThread({
      subject: thread.subject,
      senderEmail: thread.senderEmail,
      senderName: thread.senderName,
      snippet: thread.snippet,
      isKnownContact: !!contact,
      contactTier: contact?.tier ?? null,
      userId: user.id,
    });

    if (!result.needs_reply) continue;

    const { error: insertErr } = await supabase.from("inbox_items").insert({
      user_id: user.id,
      gmail_thread_id: thread.threadId,
      sender_email: thread.senderEmail,
      sender_name: thread.senderName,
      subject: thread.subject,
      snippet: thread.snippet,
      received_at: thread.receivedAt.toISOString(),
      score: result.score,
      matched_rules: result.matched_rules,
      contact_id: contact?.id ?? null,
      contact_name: contact
        ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
        : null,
      contact_tier: contact?.tier ?? null,
      status: "pending",
    });

    if (insertErr) {
      await logError(ROUTE, `inbox_items insert failed: ${insertErr.message}`, {
        thread_id: thread.threadId,
      });
      continue;
    }

    surfaced++;
  }

  return NextResponse.json({ scanned: threads.length, surfaced, skipped });
}
