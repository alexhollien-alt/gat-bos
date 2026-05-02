// Slice 7C / Task 5a -- POST /api/portal/invite
//
// Account-owner-only endpoint that issues a magic-link invitation for one of
// the owner's agent contacts.
//
// Flow:
//   1. tenantFromRequest() validates the session; user-kind only (service-role
//      callers have no business issuing portal invites).
//   2. The RLS-scoped server client fetches the target contact and verifies
//      type='agent', email + slug present, account_id implicitly matched (the
//      7B account_select policy on contacts denies cross-account reads).
//   3. crypto.randomBytes generates a 32-byte token; sha256 hash stored, the
//      plaintext only ever lives in the email body and the response payload.
//   4. INSERT into agent_invites under the account-owner's RLS session. The
//      account_id WITH CHECK policy from Task 1 prevents a forged account_id
//      from landing in the row.
//   5. sendMessage() resolves the portal-invite template (Task 5b) and
//      dispatches via the configured adapter. send_mode + body live in the
//      template row so this route stays oblivious to delivery details.
//
// Response (201):
//   { ok: true, invite_id, expires_at, recipient_email, log_id, redeem_url }
//
// The plaintext token is included in the response for ops/debug parity with
// the smoke harness (Task 7) but never persisted server-side beyond the
// rendered email.

import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { tenantFromRequest, TenantResolutionError } from "@/lib/auth/tenantFromRequest";
import { sendMessage } from "@/lib/messaging/send";

const PORTAL_INVITE_TEMPLATE_SLUG = "portal-invite";

type InviteRequestBody = {
  contact_id?: unknown;
};

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  let tenant;
  try {
    tenant = await tenantFromRequest(request);
  } catch (err) {
    if (err instanceof TenantResolutionError) {
      const status = err.code === "no_session" ? 401 : 403;
      return bad(status, err.code);
    }
    throw err;
  }

  if (tenant.kind !== "user") {
    return bad(403, "user_session_required");
  }

  let body: InviteRequestBody;
  try {
    body = (await request.json()) as InviteRequestBody;
  } catch {
    return bad(400, "invalid_json");
  }

  const contactId = typeof body.contact_id === "string" ? body.contact_id.trim() : "";
  if (!contactId) {
    return bad(400, "contact_id_required");
  }

  const supabase = await createServerSupabase();

  const { data: contact, error: contactErr } = await supabase
    .from("contacts")
    .select("id, account_id, type, email, slug, first_name")
    .eq("id", contactId)
    .is("deleted_at", null)
    .maybeSingle();

  if (contactErr) {
    return bad(500, `contact_lookup_failed:${contactErr.message}`);
  }
  if (!contact) {
    return bad(404, "contact_not_found");
  }
  if (contact.account_id !== tenant.accountId) {
    return bad(403, "cross_account_forbidden");
  }
  if (contact.type !== "agent") {
    return bad(422, "contact_not_agent");
  }
  if (!contact.email) {
    return bad(422, "contact_missing_email");
  }
  if (!contact.slug) {
    return bad(422, "contact_missing_slug");
  }

  const tokenPlaintext = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(tokenPlaintext).digest("hex");

  const { data: invite, error: inviteErr } = await supabase
    .from("agent_invites")
    .insert({
      account_id: tenant.accountId,
      contact_id: contact.id,
      token_hash: tokenHash,
    })
    .select("id, expires_at")
    .single();

  if (inviteErr) {
    return bad(500, `invite_insert_failed:${inviteErr.message}`);
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const redeemUrl = `${origin.replace(/\/+$/, "")}/portal/redeem?token=${tokenPlaintext}`;
  const portalUrl = `${origin.replace(/\/+$/, "")}/portal/${contact.slug}/dashboard`;

  const expiresAtIso = invite.expires_at as string;
  const expiresAtHuman = new Date(expiresAtIso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Phoenix",
  });

  let logId: string;
  try {
    const result = await sendMessage({
      templateSlug: PORTAL_INVITE_TEMPLATE_SLUG,
      recipient: contact.email,
      variables: {
        agent_first_name: contact.first_name ?? "",
        agent_slug: contact.slug,
        redeem_url: redeemUrl,
        portal_url: portalUrl,
        expires_at_human: expiresAtHuman,
        expires_at_iso: expiresAtIso,
      },
    });
    logId = result.logId;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: `send_failed:${message}`,
        invite_id: invite.id,
        expires_at: expiresAtIso,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      invite_id: invite.id,
      expires_at: expiresAtIso,
      recipient_email: contact.email,
      log_id: logId,
      redeem_url: redeemUrl,
    },
    { status: 201 },
  );
}
