// Intake orchestration helper for /api/intake.
//
// /api/intake is a public endpoint (no auth, service-role writes via
// adminClient). Every field in the request body ends up in the database, so
// the whole surface is an untrusted input plane. Three layers of defense:
//
//   1. Zod strict schema (`intakeSchema`) -- rejects unknown fields, caps
//      array and string lengths, and refuses payloads with the wrong shape.
//   2. `safeText` / `safeRequiredText` preprocess transforms strip HTML
//      tags and ASCII control characters, then trim and enforce max length.
//      Closes the stored-XSS path where free-text fields could later be
//      rendered as HTML.
//   3. Allow-listed product identifiers (`PRODUCT_TYPES`).
//
// Pure helpers (`buildListingData`, `buildIntakeTitle`, `splitName`,
// `intakeSchema`, sanitizers) are testable in isolation. The
// `processIntake` orchestrator owns I/O: contact resolve/create,
// material_request + items inserts, first-touch writeEvent, and
// autoEnrollNewAgent dispatch.

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { autoEnrollNewAgent } from "@/lib/campaigns/actions";
import { writeEvent } from "@/lib/activity/writeEvent";
import type { ProductType } from "@/lib/types";

export function sanitizeFreeText(input: unknown, max: number): string | undefined {
  if (typeof input !== "string") return undefined;
  const stripped = input
    .replace(/<[^>]*>/g, "") // strip HTML/XML tags
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "") // strip ASCII control chars
    .trim();
  return stripped.slice(0, max);
}

const safeText = (max: number) =>
  z.preprocess((val) => sanitizeFreeText(val, max), z.string().max(max).optional());

const safeRequiredText = (max: number) =>
  z.preprocess((val) => sanitizeFreeText(val, max), z.string().min(1).max(max));

// Product identifiers the intake form may request. Anything outside this
// list is rejected before it can land in ticket_items. Must
// match the canonical `ProductType` union in src/lib/types.ts -- that
// union mirrors the DB CHECK constraint on ticket_items.product_type.
export const PRODUCT_TYPES = [
  "flyer",
  "brochure",
  "door_hanger",
  "eddm",
  "postcard",
  "other",
] as const satisfies ReadonlyArray<ProductType>;

export const intakeSchema = z
  .object({
    products: z
      .array(z.enum(PRODUCT_TYPES))
      .min(1, "At least one product is required")
      .max(20),
    listing: z
      .object({
        address: safeText(200),
        city: safeText(100),
        state: safeText(20),
        zip: safeText(20),
        price: safeText(50),
        bedrooms: safeText(20),
        bathrooms: safeText(20),
        sqft: safeText(20),
        year_built: safeText(20),
        lot_size: safeText(50),
        garage: safeText(50),
        description: safeText(5000),
        key_features: z.array(safeRequiredText(200)).max(30).optional(),
        status: safeText(50),
        hero_image: safeText(500),
        gallery_images: z.array(safeRequiredText(500)).max(50).optional(),
        special_instructions: safeText(2000),
      })
      .strict()
      .optional(),
    agent: z
      .object({
        agent_name: safeRequiredText(150),
        agent_email: z.string().email().max(200),
        agent_phone: safeText(50),
        brokerage: safeText(150),
      })
      .strict(),
    situation: safeText(1000),
    honeypot: z.string().max(500).optional(),
  })
  .strict();

export type IntakePayload = z.infer<typeof intakeSchema>;

export interface ListingData {
  address: string;
  city: string;
  state: string;
  zip: string;
  price: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  year_built: string;
  lot_size: string;
  garage: string;
  description: string;
  key_features: string[];
  status: string;
  hero_image: string;
  gallery_images: string[];
  special_instructions: string;
}

// Build the listing_data JSONB column from the validated listing object.
// Some intakes are branding-only and have no listing block; in that case
// we emit an all-empty payload (with state defaulting to "AZ" since this
// is an Arizona-only operation).
export function buildListingData(listing: IntakePayload["listing"]): ListingData {
  const l = listing ?? {};
  return {
    address: l.address ?? "",
    city: l.city ?? "",
    state: l.state ?? "AZ",
    zip: l.zip ?? "",
    price: l.price ?? "",
    bedrooms: l.bedrooms ?? "",
    bathrooms: l.bathrooms ?? "",
    sqft: l.sqft ?? "",
    year_built: l.year_built ?? "",
    lot_size: l.lot_size ?? "",
    garage: l.garage ?? "",
    description: l.description ?? "",
    key_features: l.key_features ?? [],
    status: l.status ?? "",
    hero_image: l.hero_image ?? "",
    gallery_images: l.gallery_images ?? [],
    special_instructions: l.special_instructions ?? "",
  };
}

export function buildIntakeTitle(
  agentName: string,
  listing: IntakePayload["listing"],
  situation: string | undefined,
): string {
  return listing?.address
    ? `Intake: ${agentName} - ${listing.address}`
    : `Intake: ${agentName} - ${situation || "general"}`;
}

export interface NameSplit {
  first: string;
  last: string;
}

export function splitName(fullName: string): NameSplit {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  const first = parts[0] || trimmed;
  const last = parts.length > 1 ? parts.slice(1).join(" ") : "";
  return { first, last };
}

export function buildContactNotes(
  situation: string | undefined,
  brokerage: string | undefined,
): string {
  const situationLabel = situation || "general";
  return brokerage
    ? `Signed up via intake form (${situationLabel}). Brokerage: ${brokerage}`
    : `Signed up via intake form (${situationLabel}).`;
}

export interface ProcessIntakeResult {
  id: string;
  contactId: string | null;
  isNewContact: boolean;
}

export type ProcessIntakeError =
  | { kind: "contact_create_failed"; cause: unknown }
  | { kind: "request_create_failed"; cause: unknown };

export class IntakeProcessingError extends Error {
  constructor(
    public readonly detail: ProcessIntakeError,
    message: string,
  ) {
    super(message);
    this.name = "IntakeProcessingError";
  }
}

// Orchestrate the full intake side-effect chain. Throws
// IntakeProcessingError on contact-create or request-create failure so the
// route handler can map to a 500. Items insert errors are logged but do
// not throw (matches prior route behavior). Returns the inserted request
// id, resolved contact id, and whether the contact was newly created.
export async function processIntake(
  client: SupabaseClient,
  payload: IntakePayload,
  ownerId: string,
): Promise<ProcessIntakeResult> {
  // ── Contact resolution: find or create ──
  const { data: matchedContacts } = await client
    .from("contacts")
    .select("id")
    .ilike("email", payload.agent.agent_email)
    .limit(1);

  let contactId: string | null = matchedContacts?.[0]?.id ?? null;
  let isNewContact = false;

  if (!contactId) {
    const { first, last } = splitName(payload.agent.agent_name);
    const notes = buildContactNotes(payload.situation, payload.agent.brokerage);

    const { data: newContact, error: contactError } = await client
      .from("contacts")
      .insert({
        user_id: ownerId,
        first_name: first,
        last_name: last,
        email: payload.agent.agent_email,
        phone: payload.agent.agent_phone || null,
        brokerage: payload.agent.brokerage || null,
        type: "realtor",
        tier: "P",
        stage: "new",
        source: "website",
        health_score: 30,
        notes,
      })
      .select("id")
      .single();

    if (contactError) {
      // Fail the whole submission rather than silently continuing with
      // contactId = null. A NULL contact_id on a material_request row
      // creates an orphan that the inbox and CRM side never surface.
      console.error("Auto-create contact error:", contactError);
      throw new IntakeProcessingError(
        { kind: "contact_create_failed", cause: contactError },
        "Failed to create contact",
      );
    }
    if (newContact) {
      contactId = newContact.id;
      isNewContact = true;
    }
  }

  // ── Build listing data + title ──
  const listingData = buildListingData(payload.listing);
  const title = buildIntakeTitle(payload.agent.agent_name, payload.listing, payload.situation);

  // ── Insert ticket ──
  const { data: req, error: reqError } = await client
    .from("tickets")
    .insert({
      contact_id: contactId,
      title,
      request_type: "design_help",
      status: "submitted",
      priority: "standard",
      source: "intake",
      listing_data: listingData,
      submitter_name: payload.agent.agent_name,
      submitter_email: payload.agent.agent_email,
      submitter_phone: payload.agent.agent_phone || null,
      submitted_at: new Date().toISOString(),
      notes: payload.agent.brokerage ? `Brokerage: ${payload.agent.brokerage}` : null,
    })
    .select("id")
    .single();

  if (reqError || !req) {
    console.error("Intake request insert error:", reqError);
    throw new IntakeProcessingError(
      { kind: "request_create_failed", cause: reqError },
      "Failed to create request",
    );
  }

  // ── Insert line items (one per selected product) ──
  const items = payload.products.map((product) => ({
    request_id: req.id,
    product_type: product,
    quantity: 1,
    description: null,
  }));

  const { error: itemsError } = await client.from("ticket_items").insert(items);
  if (itemsError) {
    // Log and continue -- matches prior route behavior. The request row
    // exists; missing items show up in inbox triage.
    console.error("Intake items insert error:", itemsError);
  }

  // ── Log first touch interaction for new contacts ──
  if (isNewContact && contactId) {
    void writeEvent({
      actorId: ownerId,
      verb: "interaction.note",
      object: { table: "contacts", id: contactId },
      context: {
        contact_id: contactId,
        type: "note",
        summary: `Submitted intake form (${payload.situation || "general"}). Products requested: ${payload.products.join(", ")}.`,
        direction: "inbound",
        source: "intake",
      },
    });

    // Auto-enroll new realtor contacts in "New Agent Onboarding". Fire-and-
    // forget: silent no-op if the campaign isn't active. Intake always
    // creates type='realtor' so every new intake contact qualifies.
    await autoEnrollNewAgent(client, contactId, ownerId);
  }

  return { id: req.id, contactId, isNewContact };
}
