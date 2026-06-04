"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { writeEvent } from "@/lib/activity/writeEvent";
import { buildBlastSlug } from "@/lib/open-house/slug";
import { getMatchedAudience } from "@/lib/open-house/recipients";

const blastSchema = z.object({
  agentContactId: z.string().uuid("Pick the hosting agent"),
  address: z.string().trim().min(3, "Address required"),
  city: z.string().trim().min(2, "City required"),
  state: z.string().trim().default("AZ"),
  price: z.string().trim().optional().nullable(),
  openHouseDate: z.string().min(8, "Date required"), // YYYY-MM-DD
  openHouseStart: z.string().optional().nullable(),
  openHouseEnd: z.string().optional().nullable(),
  details: z.string().trim().optional().nullable(),
  beds: z.coerce.number().optional().nullable(),
  baths: z.coerce.number().optional().nullable(),
  sqft: z.coerce.number().int().optional().nullable(),
  photo1Url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  photo2Url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  emailSubject: z.string().trim().optional().nullable(),
});

export type CreateBlastResult =
  | { ok: true; id: string; slug: string; recipientCount: number }
  | { ok: false; error: string };

async function primaryAccountId(userId: string): Promise<string | null> {
  const { data } = await adminClient
    .from("accounts")
    .select("id")
    .eq("owner_user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);
  return data?.[0]?.id ?? null;
}

export async function setAutoSend(blastId: string, value: boolean): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase
    .from("open_house_blasts")
    .update({ auto_send: value })
    .eq("id", blastId)
    .eq("user_id", user.id);
  return { ok: !error };
}

export async function createBlast(input: unknown): Promise<CreateBlastResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const parsed = blastSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const accountId = await primaryAccountId(user.id);
  if (!accountId) return { ok: false, error: "No account found for user" };

  const photos = [d.photo1Url, d.photo2Url].filter((p): p is string => !!p && p.trim().length > 0);
  const slug = buildBlastSlug(d.address, d.city);

  // Snapshot the matched recipient count at creation.
  const audience = await getMatchedAudience({ userId: user.id, city: d.city });

  const { data: blast, error } = await supabase
    .from("open_house_blasts")
    .insert({
      account_id: accountId,
      user_id: user.id,
      agent_contact_id: d.agentContactId,
      slug,
      address: d.address,
      city: d.city,
      state: d.state || "AZ",
      price: d.price || null,
      open_house_date: d.openHouseDate,
      open_house_start: d.openHouseStart || null,
      open_house_end: d.openHouseEnd || null,
      details: d.details || null,
      beds: d.beds ?? null,
      baths: d.baths ?? null,
      sqft: d.sqft ?? null,
      photos,
      hero_image_url: photos[0] ?? null,
      email_subject: d.emailSubject || null,
      status: "draft",
      auto_send: false,
      recipient_count: audience.count,
    })
    .select("id, slug")
    .single();

  if (error || !blast) {
    return { ok: false, error: error?.message ?? "Insert failed" };
  }

  await writeEvent({
    userId: user.id,
    actorId: user.id,
    verb: "open_house.blast.created",
    object: { table: "open_house_blasts", id: blast.id },
    context: {
      city: d.city,
      address: d.address,
      recipient_count: audience.count,
    },
  });

  return { ok: true, id: blast.id, slug: blast.slug, recipientCount: audience.count };
}
