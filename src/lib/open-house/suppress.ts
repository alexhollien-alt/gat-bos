// src/lib/open-house/suppress.ts
// Status-flip suppression. The contact's email_status IS the suppression list,
// so suppressing == flipping status (never a hard delete). Once flipped off
// 'active', getSendRecipients never matches the contact again.

import { adminClient } from "@/lib/supabase/admin";
import { writeEvent } from "@/lib/activity/writeEvent";
import type { ActivityVerb } from "@/lib/activity/types";

// Suppression states are terminal relative to one another: never downgrade a
// complaint back to a bounce, etc. Only 'active' is mailable.
const FINAL_STATES = new Set(["unsubscribed", "bounced", "complained", "manual_suppressed"]);

export async function suppressByToken(
  token: string,
  detail: string,
): Promise<{ ok: boolean; already?: boolean; contactId?: string }> {
  const { data } = await adminClient
    .from("contacts")
    .select("id, user_id, email_status")
    .eq("unsubscribe_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return { ok: false };

  if (data.email_status === "unsubscribed") {
    return { ok: true, already: true, contactId: data.id as string };
  }

  await adminClient
    .from("contacts")
    .update({
      email_status: "unsubscribed",
      email_status_reason: detail,
      email_status_at: new Date().toISOString(),
    })
    .eq("id", data.id);

  await writeEvent({
    userId: data.user_id as string,
    actorId: data.id as string,
    verb: "open_house.unsubscribed",
    object: { table: "contacts", id: data.id as string },
    context: { reason: detail },
  });

  return { ok: true, contactId: data.id as string };
}

// Used by the Resend webhook for bounces / complaints. Flips every active
// contact matching the email to the given suppression state.
export async function suppressByEmail(
  email: string,
  status: "bounced" | "complained",
  detail: string,
): Promise<{ ok: boolean; suppressed: number }> {
  const verb: ActivityVerb =
    status === "complained" ? "open_house.email.complained" : "open_house.email.bounced";

  const { data } = await adminClient
    .from("contacts")
    .select("id, user_id, email_status")
    .ilike("email", email)
    .is("deleted_at", null);
  if (!data || data.length === 0) return { ok: true, suppressed: 0 };

  let suppressed = 0;
  for (const c of data) {
    const cur = c.email_status as string;
    // Do not downgrade a complaint to a bounce; do not re-flip an opt-out.
    if (cur === "complained") continue;
    if (cur === "unsubscribed" && status === "bounced") continue;
    if (FINAL_STATES.has(cur) && cur === status) continue;

    await adminClient
      .from("contacts")
      .update({
        email_status: status,
        email_status_reason: detail,
        email_status_at: new Date().toISOString(),
      })
      .eq("id", c.id);

    await writeEvent({
      userId: c.user_id as string,
      actorId: c.id as string,
      verb,
      object: { table: "contacts", id: c.id as string },
      context: { reason: detail, email },
    });
    suppressed++;
  }
  return { ok: true, suppressed };
}
