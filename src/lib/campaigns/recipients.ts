// src/lib/campaigns/recipients.ts
// Recipient list resolver for Weekly Edge mass-send. Slice 8 Phase 4.
//
// v1: a recipient list is a slug + a query against contacts. The 'agents-active'
// list returns every active agent contact (type='agent', deleted_at IS NULL)
// from the seed-agent set landed in Slice 7B.
//
// LATER.md: replace with a first-class recipient_lists table when subscriber
// preferences (per-list opt-in / opt-out) ship.

import { adminClient } from "@/lib/supabase/admin";

export interface Recipient {
  email: string;
  contactId: string;
  fullName: string | null;
  userId: string | null;
}

export interface RecipientListResolution {
  slug: string;
  label: string;
  recipients: Recipient[];
}

const KNOWN_LISTS = new Set(["agents-active"]);

export function isKnownRecipientList(slug: string): boolean {
  return KNOWN_LISTS.has(slug);
}

export async function resolveRecipientList(
  slug: string,
): Promise<RecipientListResolution> {
  if (!isKnownRecipientList(slug)) {
    throw new Error(`Unknown recipient list slug: '${slug}'`);
  }

  if (slug === "agents-active") {
    const { data, error } = await adminClient
      .from("contacts")
      .select("id, email, full_name, user_id, type, deleted_at")
      .eq("type", "agent")
      .is("deleted_at", null)
      .not("email", "is", null);

    if (error) {
      throw new Error(`Failed to resolve recipient list 'agents-active': ${error.message}`);
    }

    const recipients: Recipient[] = (data ?? [])
      .filter((row) => typeof row.email === "string" && row.email.length > 0)
      .map((row) => ({
        email: row.email as string,
        contactId: row.id,
        fullName: row.full_name ?? null,
        userId: row.user_id ?? null,
      }));

    return {
      slug,
      label: "Active agents",
      recipients,
    };
  }

  throw new Error(`Recipient list resolver fall-through: '${slug}'`);
}
