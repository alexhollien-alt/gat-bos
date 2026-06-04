// src/lib/open-house/recipients.ts
// City-segmented recipient matching for open house blasts. Service-role reads
// (adminClient) so callers must scope by the owner's accounts explicitly.
//
// SCAR invariant: matching ALWAYS requires a non-empty city. There is no
// "match everyone" path. An empty/blank city returns zero recipients.

import { adminClient } from "@/lib/supabase/admin";
import { MAILABLE_STATUS, RECIPIENT_TYPES } from "./config";
import {
  partitionContacts,
  type PreflightRecipient,
  type ExcludedRecipient,
  type RawContactRow,
} from "@/lib/messaging/preflight";

export interface MatchedAudience {
  city: string;
  mailable: PreflightRecipient[]; // active + has email
  excluded: ExcludedRecipient[]; // suppressed / no email / soft-deleted
  total: number; // mailable + excluded
  count: number; // mailable count (what the form shows)
}

interface ContactRow extends RawContactRow {
  id: string;
  city: string | null;
  email_status: string | null;
}

// Accounts owned by a user. Service-role queries bypass RLS, so we replicate
// the RLS scope manually.
export async function ownedAccountIds(userId: string): Promise<string[]> {
  const { data, error } = await adminClient
    .from("accounts")
    .select("id")
    .eq("owner_user_id", userId)
    .is("deleted_at", null);
  if (error || !data) return [];
  return data.map((r) => r.id as string);
}

// Match every mailable agent in the owner's pool whose city tag equals the
// listing city. Suppressed contacts (status != active) are returned as
// excluded so the preflight report shows who was held back and why.
export async function getMatchedAudience(params: {
  userId: string;
  city: string;
}): Promise<MatchedAudience> {
  const city = params.city?.trim() ?? "";
  if (!city) {
    // SCAR: no city, no send. Never a blob.
    return { city: "", mailable: [], excluded: [], total: 0, count: 0 };
  }

  const accountIds = await ownedAccountIds(params.userId);
  if (accountIds.length === 0) {
    return { city, mailable: [], excluded: [], total: 0, count: 0 };
  }

  const { data, error } = await adminClient
    .from("contacts")
    .select("id, first_name, last_name, email, brokerage, deleted_at, city, email_status")
    .in("account_id", accountIds)
    .in("type", RECIPIENT_TYPES as unknown as string[])
    .ilike("city", city)
    .is("deleted_at", null);

  if (error || !data) {
    return { city, mailable: [], excluded: [], total: 0, count: 0 };
  }

  const rows = data as ContactRow[];

  // Suppressed (status != active) are pulled out as excluded before partition.
  const suppressed: ExcludedRecipient[] = [];
  const active: RawContactRow[] = [];
  for (const r of rows) {
    if (r.email_status && r.email_status !== MAILABLE_STATUS) {
      const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "(no name)";
      suppressed.push({ email: r.email, name, reason: `suppressed: ${r.email_status}` });
      continue;
    }
    active.push(r);
  }

  const { included, excluded } = partitionContacts(active);
  const allExcluded = [...suppressed, ...excluded];

  return {
    city,
    mailable: included,
    excluded: allExcluded,
    total: included.length + allExcluded.length,
    count: included.length,
  };
}

// Lightweight count for the live form indicator.
export async function getRecipientCount(params: {
  userId: string;
  city: string;
}): Promise<number> {
  const audience = await getMatchedAudience(params);
  return audience.count;
}

// Full contact rows (with id + token) for the send loop, which needs the
// unsubscribe token and contact id per recipient. Mailable only.
export interface SendRecipient {
  contactId: string;
  email: string;
  firstName: string;
  name: string;
  unsubscribeToken: string;
}

export async function getSendRecipients(params: {
  userId: string;
  city: string;
}): Promise<SendRecipient[]> {
  const city = params.city?.trim() ?? "";
  if (!city) return [];
  const accountIds = await ownedAccountIds(params.userId);
  if (accountIds.length === 0) return [];

  const { data, error } = await adminClient
    .from("contacts")
    .select("id, first_name, last_name, email, unsubscribe_token")
    .in("account_id", accountIds)
    .in("type", RECIPIENT_TYPES as unknown as string[])
    .ilike("city", city)
    .eq("email_status", MAILABLE_STATUS)
    .is("deleted_at", null)
    .not("email", "is", null);

  if (error || !data) return [];

  return (data as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    unsubscribe_token: string;
  }>)
    .filter((r) => r.email && r.email.trim())
    .map((r) => ({
      contactId: r.id,
      email: r.email!.trim(),
      firstName: (r.first_name ?? "").trim() || "there",
      name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "(no name)",
      unsubscribeToken: r.unsubscribe_token,
    }));
}
