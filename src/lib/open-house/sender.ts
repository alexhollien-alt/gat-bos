// src/lib/open-house/sender.ts
// Orchestration for the open house blast: preview builder + the batched,
// throttled, warmup-capped, preflight-gated send that writes the blast_sends
// ledger and the activity_events summary.

import { adminClient } from "@/lib/supabase/admin";
import { writeEvent } from "@/lib/activity/writeEvent";
import {
  BLAST_FROM_ADDRESS,
  BLAST_REPLY_TO,
  PUBLIC_BASE_URL,
  UNSUBSCRIBE_MAILTO,
  FOOTER_ADDRESS,
  BATCH_SIZE,
  THROTTLE_MS,
} from "./config";
import { getMatchedAudience, getSendRecipients } from "./recipients";
import { buildOpenHouseEmail, type OpenHouseEmailAgent, type OpenHouseEmailBlast } from "./email";
import { sendBlastEmail } from "./resend-blast";
import {
  buildPreflightReport,
  evaluatePreflight,
  checkImageUrls,
  formatPreflightReport,
  type PreflightEvaluation,
} from "@/lib/messaging/preflight";

interface AgentJoin {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  headshot_url: string | null;
}

interface BlastFull {
  id: string;
  user_id: string;
  account_id: string;
  agent_contact_id: string;
  slug: string;
  address: string;
  city: string;
  state: string | null;
  price: string | null;
  open_house_date: string;
  open_house_start: string | null;
  open_house_end: string | null;
  details: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  photos: string[] | null;
  hero_image_url: string | null;
  email_subject: string | null;
  status: string;
  auto_send: boolean;
  daily_send_cap: number | null;
  recipient_count: number | null;
  sent_at: string | null;
  agent: AgentJoin | null;
}

const ALREADY_SENT = new Set(["sent", "delivered", "opened", "clicked", "bounced", "complained"]);

const SELECT =
  "id, user_id, account_id, agent_contact_id, slug, address, city, state, price, open_house_date, open_house_start, open_house_end, details, beds, baths, sqft, photos, hero_image_url, email_subject, status, auto_send, daily_send_cap, recipient_count, sent_at, agent:contacts!agent_contact_id(first_name, last_name, full_name, email, phone, brokerage, headshot_url)";

export async function loadBlast(blastId: string): Promise<BlastFull | null> {
  const { data, error } = await adminClient
    .from("open_house_blasts")
    .select(SELECT)
    .eq("id", blastId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as BlastFull;
}

function agentForEmail(a: AgentJoin | null): OpenHouseEmailAgent {
  const name = a?.full_name?.trim() || `${a?.first_name ?? ""} ${a?.last_name ?? ""}`.trim() || "Your agent";
  return {
    name,
    firstName: a?.first_name?.trim() || name.split(" ")[0] || "Your agent",
    brokerage: a?.brokerage ?? null,
    email: a?.email ?? null,
    phone: a?.phone ?? null,
  };
}

function blastForEmail(b: BlastFull): OpenHouseEmailBlast {
  return {
    address: b.address,
    city: b.city,
    state: b.state,
    price: b.price,
    openHouseDate: b.open_house_date,
    openHouseStart: b.open_house_start,
    openHouseEnd: b.open_house_end,
    details: b.details,
    beds: b.beds,
    baths: b.baths,
    sqft: b.sqft,
    heroImageUrl: b.hero_image_url ?? b.photos?.[0] ?? null,
    subjectOverride: b.email_subject,
  };
}

export function landingUrlFor(slug: string): string {
  return `${PUBLIC_BASE_URL}/open-house/${slug}`;
}
export function unsubscribeUrlFor(token: string): string {
  return `${PUBLIC_BASE_URL}/u/${token}`;
}

export interface BlastPreview {
  blast: BlastFull;
  agent: OpenHouseEmailAgent;
  recipientCount: number;
  suppressedCount: number;
  landingUrl: string;
  sample: { subject: string; html: string; text: string };
  preflight: { formatted: string; evaluation: PreflightEvaluation };
}

// Read-only preview used by the preview page (no send).
export async function buildBlastPreview(blastId: string): Promise<BlastPreview | null> {
  const blast = await loadBlast(blastId);
  if (!blast) return null;

  const audience = await getMatchedAudience({ userId: blast.user_id, city: blast.city });
  const agent = agentForEmail(blast.agent);
  const landingUrl = landingUrlFor(blast.slug);

  const sampleRecipient = audience.mailable[0]?.name?.split(" ")[0] || "there";
  const sample = buildOpenHouseEmail({
    recipientFirstName: sampleRecipient,
    agent,
    blast: blastForEmail(blast),
    landingUrl,
    unsubscribeUrl: unsubscribeUrlFor("preview-token-sample"),
    footerAddress: FOOTER_ADDRESS,
  });

  const report = buildPreflightReport({
    subject: sample.subject,
    html: sample.html,
    recipients: audience.mailable,
    excluded: audience.excluded,
    filterDescription: `Active agents tagged city = ${blast.city}`,
    expectedCount: audience.count,
  });
  // Only check the listing hero (compliance logos are app-local assets).
  report.imageChecks = blast.hero_image_url ? await checkImageUrls([blast.hero_image_url]) : [];
  const evaluation = evaluatePreflight(report);

  return {
    blast,
    agent,
    recipientCount: audience.count,
    suppressedCount: audience.excluded.length,
    landingUrl,
    sample,
    preflight: { formatted: formatPreflightReport(report, evaluation), evaluation },
  };
}

export interface SendSummary {
  ok: boolean;
  sent: number;
  failed: number;
  skipped: number; // already sent in a prior run
  held: number; // over the warmup cap, left queued
  total: number;
  report?: string;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Executes the send. Idempotent: recipients already sent are skipped. Honors
// the warmup cap (daily_send_cap): recipients beyond the cap are recorded as
// queued and not mailed this run.
export async function sendBlast(params: {
  blastId: string;
  actorUserId: string;
}): Promise<SendSummary> {
  const blast = await loadBlast(params.blastId);
  if (!blast) return { ok: false, sent: 0, failed: 0, skipped: 0, held: 0, total: 0, error: "Blast not found" };
  if (blast.status === "canceled") {
    return { ok: false, sent: 0, failed: 0, skipped: 0, held: 0, total: 0, error: "Blast is canceled" };
  }

  const recipients = await getSendRecipients({ userId: blast.user_id, city: blast.city });
  // SCAR: never an empty/blob send.
  if (recipients.length === 0) {
    return { ok: false, sent: 0, failed: 0, skipped: 0, held: 0, total: 0, error: "No matched recipients for city" };
  }

  const agent = agentForEmail(blast.agent);
  const landingUrl = landingUrlFor(blast.slug);

  // Preflight gate on a representative email.
  const sample = buildOpenHouseEmail({
    recipientFirstName: recipients[0].firstName,
    agent,
    blast: blastForEmail(blast),
    landingUrl,
    unsubscribeUrl: unsubscribeUrlFor(recipients[0].unsubscribeToken),
    footerAddress: FOOTER_ADDRESS,
  });
  const report = buildPreflightReport({
    subject: sample.subject,
    html: sample.html,
    recipients: recipients.map((r) => ({ email: r.email, name: r.name })),
    excluded: [],
    filterDescription: `Active agents tagged city = ${blast.city}`,
  });
  report.imageChecks = blast.hero_image_url ? await checkImageUrls([blast.hero_image_url]) : [];
  const evaluation = evaluatePreflight(report);
  const formatted = formatPreflightReport(report, evaluation);
  if (!evaluation.pass) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      skipped: 0,
      held: 0,
      total: recipients.length,
      report: formatted,
      error: "Preflight failed",
    };
  }

  // Mark sending.
  await adminClient
    .from("open_house_blasts")
    .update({ status: "sending", sending_started_at: new Date().toISOString(), recipient_count: recipients.length })
    .eq("id", blast.id);

  // Existing send rows for idempotency.
  const { data: existingRows } = await adminClient
    .from("blast_sends")
    .select("id, recipient_email, status")
    .eq("blast_id", blast.id)
    .is("deleted_at", null);
  const existing = new Map<string, { id: string; status: string }>();
  for (const r of existingRows ?? []) {
    existing.set(String(r.recipient_email).toLowerCase(), { id: r.id as string, status: r.status as string });
  }

  // Warmup cap.
  const cap = blast.daily_send_cap ?? recipients.length;
  const toSend = recipients.slice(0, cap);
  const held = recipients.slice(cap);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < toSend.length; i++) {
    const r = toSend[i];
    const key = r.email.toLowerCase();
    const prior = existing.get(key);
    if (prior && ALREADY_SENT.has(prior.status)) {
      skipped++;
      continue;
    }
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    const email = buildOpenHouseEmail({
      recipientFirstName: r.firstName,
      agent,
      blast: blastForEmail(blast),
      landingUrl,
      unsubscribeUrl: unsubscribeUrlFor(r.unsubscribeToken),
      footerAddress: FOOTER_ADDRESS,
    });

    try {
      const { messageId } = await sendBlastEmail({
        to: r.email,
        fromName: agent.name,
        fromAddress: BLAST_FROM_ADDRESS,
        replyTo: agent.email || BLAST_REPLY_TO,
        subject: email.subject,
        html: email.html,
        text: email.text,
        unsubscribeUrl: unsubscribeUrlFor(r.unsubscribeToken),
        unsubscribeMailto: `mailto:${UNSUBSCRIBE_MAILTO}?subject=unsubscribe`,
      });
      const row = {
        blast_id: blast.id,
        account_id: blast.account_id,
        contact_id: r.contactId,
        recipient_email: r.email,
        recipient_name: r.name,
        provider_message_id: messageId,
        batch_number: batchNumber,
        status: "sent",
        sent_at: new Date().toISOString(),
        error_message: null,
      };
      if (prior) {
        await adminClient.from("blast_sends").update(row).eq("id", prior.id);
      } else {
        await adminClient.from("blast_sends").insert(row);
      }
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const row = {
        blast_id: blast.id,
        account_id: blast.account_id,
        contact_id: r.contactId,
        recipient_email: r.email,
        recipient_name: r.name,
        batch_number: batchNumber,
        status: "failed",
        error_message: msg,
      };
      if (prior) {
        await adminClient.from("blast_sends").update(row).eq("id", prior.id);
      } else {
        await adminClient.from("blast_sends").insert(row);
      }
      failed++;
    }

    if (i < toSend.length - 1) await sleep(THROTTLE_MS);
  }

  // Record held (over-cap) recipients as queued, not mailed.
  for (const r of held) {
    const key = r.email.toLowerCase();
    if (existing.has(key)) continue;
    await adminClient.from("blast_sends").insert({
      blast_id: blast.id,
      account_id: blast.account_id,
      contact_id: r.contactId,
      recipient_email: r.email,
      recipient_name: r.name,
      status: "queued",
    });
  }

  const fullyDone = held.length === 0;
  await adminClient
    .from("open_house_blasts")
    .update({
      status: fullyDone ? "sent" : "sending",
      sent_at: fullyDone ? new Date().toISOString() : null,
    })
    .eq("id", blast.id);

  await writeEvent({
    userId: blast.user_id,
    actorId: params.actorUserId,
    verb: "open_house.blast.sent",
    object: { table: "open_house_blasts", id: blast.id },
    context: { city: blast.city, sent, failed, skipped, held: held.length, total: recipients.length },
  });

  return {
    ok: true,
    sent,
    failed,
    skipped,
    held: held.length,
    total: recipients.length,
    report: formatted,
  };
}
