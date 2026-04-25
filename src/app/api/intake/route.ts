import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { autoEnrollNewAgent } from "@/lib/campaigns/auto-enroll";
import { writeEvent } from "@/lib/activity/writeEvent";

// ---------------------------------------------------------------------------
// Input validation and sanitization
// ---------------------------------------------------------------------------
//
// /api/intake is a public endpoint (no auth, service-role writes via
// adminClient). Every field in the request body ends up in the database,
// so the whole surface is an untrusted input plane. Three layers of
// defense here:
//
//   1. Zod strict schema -- rejects unknown fields, caps array and string
//      lengths, and refuses payloads with the wrong shape entirely.
//   2. safeText transform -- strips HTML tags and ASCII control characters
//      from every free-text field, then trims and enforces a max length.
//      Closes the stored-XSS path where `notes`, `situation`, or
//      `description` could later be rendered as HTML.
//   3. Allow-listed product identifiers -- we don't trust the client to
//      name `product_type`, and it goes to a table with a CHECK or FK.
//
// Defense NOT yet in place here, still TODO:
//   - Rate limiting by IP (Upstash / Vercel KV / a ratelimit_tokens table).
//     Until this lands, a single attacker can DoS the inbox.
//   - Turnstile / hCaptcha / reCAPTCHA server verification. The honeypot
//     alone is weak; a headless browser will bypass it.
//
// Both of those require infra decisions; they are deferred to a follow-up.

function sanitizeFreeText(input: unknown, max: number): string | undefined {
  if (typeof input !== "string") return undefined;
  const stripped = input
    .replace(/<[^>]*>/g, "")          // strip HTML/XML tags
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "") // strip ASCII control chars
    .trim();
  return stripped.slice(0, max);
}

const safeText = (max: number) =>
  z.preprocess((val) => sanitizeFreeText(val, max), z.string().max(max).optional());

const safeRequiredText = (max: number) =>
  z.preprocess(
    (val) => sanitizeFreeText(val, max),
    z.string().min(1).max(max),
  );

// Product identifiers the intake form may request. Anything outside this
// list is rejected before it can land in material_request_items. Must
// match the canonical `ProductType` union in src/lib/types.ts -- that
// union mirrors the DB CHECK constraint on material_request_items.product_type.
const PRODUCT_TYPES = [
  "flyer",
  "brochure",
  "door_hanger",
  "eddm",
  "postcard",
  "other",
] as const satisfies ReadonlyArray<
  import("@/lib/types").ProductType
>;

const intakeSchema = z
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

type IntakePayload = z.infer<typeof intakeSchema>;

export async function POST(request: Request) {
  try {
    // Hard-pinned CRM owner. Set OWNER_USER_ID in .env.local to Alex's
    // auth.users id (b735d691-4d86-4e31-9fd3-c2257822dca3). Replaces the
    // previous listUsers({perPage: 1}) lookup which was non-deterministic
    // when auth.users had more than one row.
    const ownerId = process.env.OWNER_USER_ID;
    if (!ownerId) {
      console.error("Intake API: OWNER_USER_ID env var not set");
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      );
    }

    const rawBody = await request.json();
    const parsed = intakeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const body: IntakePayload = parsed.data;

    // Honeypot spam check. Return a UUID-shaped id so any client parsing
    // `id` as a UUID does not blow up or accept a sentinel.
    if (body.honeypot && body.honeypot.length > 0) {
      return NextResponse.json({ id: randomUUID() }, { status: 201 });
    }

    // ── Contact resolution: find or create ──
    const { data: matchedContacts } = await adminClient
      .from("contacts")
      .select("id")
      .ilike("email", body.agent.agent_email)
      .limit(1);

    let contactId: string | null = matchedContacts?.[0]?.id ?? null;
    let isNewContact = false;

    if (!contactId) {
      // New agent -- create contact, tier P (sphere/prospect)
      const nameParts = body.agent.agent_name.trim().split(/\s+/);
      const firstName = nameParts[0] || body.agent.agent_name;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

      const situationLabel = body.situation || "general";
      const brokerageLabel = body.agent.brokerage;
      const notesText = brokerageLabel
        ? `Signed up via intake form (${situationLabel}). Brokerage: ${brokerageLabel}`
        : `Signed up via intake form (${situationLabel}).`;

      const { data: newContact, error: contactError } = await adminClient
        .from("contacts")
        .insert({
          user_id: ownerId,
          first_name: firstName,
          last_name: lastName,
          email: body.agent.agent_email,
          phone: body.agent.agent_phone || null,
          brokerage: brokerageLabel || null,
          type: "realtor",
          tier: "P",
          stage: "new",
          source: "website",
          health_score: 30,
          notes: notesText,
        })
        .select("id")
        .single();

      if (contactError) {
        // Fail the whole submission rather than silently continuing with
        // contactId = null. A NULL contact_id on a material_request row
        // creates an orphan that the inbox and CRM side never surface,
        // and the client receives a misleading 201 in the old flow.
        console.error("Auto-create contact error:", contactError);
        return NextResponse.json(
          { error: "Failed to create contact" },
          { status: 500 }
        );
      }
      if (newContact) {
        contactId = newContact.id;
        isNewContact = true;
      }
    }

    // ── Build listing data JSONB (optional now -- some intakes are branding-only) ──
    const listing = body.listing ?? {};
    const listingData = {
      address: listing.address ?? "",
      city: listing.city ?? "",
      state: listing.state ?? "AZ",
      zip: listing.zip ?? "",
      price: listing.price ?? "",
      bedrooms: listing.bedrooms ?? "",
      bathrooms: listing.bathrooms ?? "",
      sqft: listing.sqft ?? "",
      year_built: listing.year_built ?? "",
      lot_size: listing.lot_size ?? "",
      garage: listing.garage ?? "",
      description: listing.description ?? "",
      key_features: listing.key_features ?? [],
      status: listing.status ?? "",
      hero_image: listing.hero_image ?? "",
      gallery_images: listing.gallery_images ?? [],
      special_instructions: listing.special_instructions ?? "",
    };

    const title = listing.address
      ? `Intake: ${body.agent.agent_name} - ${listing.address}`
      : `Intake: ${body.agent.agent_name} - ${body.situation || "general"}`;

    // ── Insert material_request ──
    const { data: req, error: reqError } = await adminClient
      .from("material_requests")
      .insert({
        contact_id: contactId,
        title,
        request_type: "design_help",
        status: "submitted",
        priority: "standard",
        source: "intake",
        listing_data: listingData,
        submitter_name: body.agent.agent_name,
        submitter_email: body.agent.agent_email,
        submitter_phone: body.agent.agent_phone || null,
        submitted_at: new Date().toISOString(),
        notes: body.agent.brokerage
          ? `Brokerage: ${body.agent.brokerage}`
          : null,
      })
      .select("id")
      .single();

    if (reqError || !req) {
      console.error("Intake request insert error:", reqError);
      return NextResponse.json(
        { error: "Failed to create request" },
        { status: 500 }
      );
    }

    // ── Insert line items (one per selected product) ──
    const items = body.products.map((product) => ({
      request_id: req.id,
      product_type: product,
      quantity: 1,
      description: null,
    }));

    const { error: itemsError } = await adminClient
      .from("material_request_items")
      .insert(items);

    if (itemsError) {
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
          summary: `Submitted intake form (${body.situation || "general"}). Products requested: ${body.products.join(", ")}.`,
          direction: "inbound",
          source: "intake",
        },
      });

      // Auto-enroll new realtor contacts in "New Agent Onboarding". Fire-and-
      // forget: silent no-op if the campaign isn't active. Intake always
      // creates type='realtor' so every new intake contact qualifies.
      await autoEnrollNewAgent(adminClient, contactId, ownerId);
    }

    return NextResponse.json(
      { id: req.id, contactId, isNewContact },
      { status: 201 }
    );
  } catch (err) {
    console.error("Intake API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
