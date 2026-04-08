import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import type { ProductType } from "@/lib/types";

interface IntakePayload {
  products: ProductType[];
  listing?: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    price?: string;
    bedrooms?: string;
    bathrooms?: string;
    sqft?: string;
    year_built?: string;
    lot_size?: string;
    garage?: string;
    description?: string;
    key_features?: string[];
    status?: string;
    hero_image?: string;
    gallery_images?: string[];
    special_instructions?: string;
  };
  agent: {
    agent_name: string;
    agent_email: string;
    agent_phone?: string;
    brokerage?: string;
  };
  situation?: string;
  honeypot?: string;
}

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

    const body: IntakePayload = await request.json();

    // Honeypot spam check
    if (body.honeypot) {
      return NextResponse.json({ id: "ok" }, { status: 201 });
    }

    if (!body.products?.length || !body.agent?.agent_name || !body.agent?.agent_email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ── Contact resolution: find or create ──
    const { data: matchedContacts } = await adminClient
      .from("contacts")
      .select("id")
      .ilike("email", body.agent.agent_email)
      .limit(1);

    let contactId = matchedContacts?.[0]?.id ?? null;
    let isNewContact = false;

    if (!contactId) {
      // New agent -- create contact, tier P (sphere/prospect)
      const nameParts = body.agent.agent_name.trim().split(/\s+/);
      const firstName = nameParts[0] || body.agent.agent_name;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

      const { data: newContact, error: contactError } = await adminClient
        .from("contacts")
        .insert({
          user_id: ownerId,
          first_name: firstName,
          last_name: lastName,
          email: body.agent.agent_email,
          phone: body.agent.agent_phone || null,
          brokerage: body.agent.brokerage || null,
          type: "realtor",
          tier: "P",
          stage: "new",
          source: "website",
          health_score: 30,
          notes: body.agent.brokerage
            ? `Signed up via intake form (${body.situation || "general"}). Brokerage: ${body.agent.brokerage}`
            : `Signed up via intake form (${body.situation || "general"}).`,
        })
        .select("id")
        .single();

      if (contactError) {
        console.error("Auto-create contact error:", contactError);
      } else if (newContact) {
        contactId = newContact.id;
        isNewContact = true;
      }
    }

    // ── Build listing data JSONB (optional now -- some intakes are branding-only) ──
    const listing = body.listing || {};
    const listingData = {
      address: listing.address || "",
      city: listing.city || "",
      state: listing.state || "AZ",
      zip: listing.zip || "",
      price: listing.price || "",
      bedrooms: listing.bedrooms || "",
      bathrooms: listing.bathrooms || "",
      sqft: listing.sqft || "",
      year_built: listing.year_built || "",
      lot_size: listing.lot_size || "",
      garage: listing.garage || "",
      description: listing.description || "",
      key_features: listing.key_features || [],
      status: listing.status || "",
      hero_image: listing.hero_image || "",
      gallery_images: listing.gallery_images || [],
      special_instructions: listing.special_instructions || "",
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
      await adminClient.from("interactions").insert({
        user_id: ownerId,
        contact_id: contactId,
        type: "note",
        direction: "inbound",
        summary: `Submitted intake form (${body.situation || "general"}). Products requested: ${body.products.join(", ")}.`,
      });
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
