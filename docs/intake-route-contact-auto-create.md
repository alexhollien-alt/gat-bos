# /api/intake Contact Auto-Create Flow

## What it does

Public POST endpoint that accepts intake form submissions from the
`/intake` landing page. Looks up or creates a contact, writes a
`material_requests` row with the listing JSONB and submitter info,
fans out one `material_request_items` row per selected product, and
logs a first-touch interaction for new contacts.

## Where it lives

`/Users/alex/crm/src/app/api/intake/route.ts` (202 lines).

## Payload shape

```ts
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
```

The `listing` block is optional; some intakes are branding-only and
don't reference a property.

## Flow

### 1. Owner resolution (lines 42 to 49)

```ts
const ownerId = process.env.OWNER_USER_ID;
if (!ownerId) {
  return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
}
```

Hard-pinned to Alex's `auth.users.id` in env. Replaces a previous
`listUsers({perPage: 1})` lookup that was non-deterministic when
`auth.users` had more than one row.

### 2. Honeypot check (lines 54 to 56)

```ts
if (body.honeypot) {
  return NextResponse.json({ id: "ok" }, { status: 201 });
}
```

If the bot fills the hidden field, return a fake success so crawlers
can't detect the guard. No DB writes happen.

### 3. Required field validation (line 58)

`products` must be a non-empty array, `agent.agent_name` and
`agent.agent_email` must be set. Everything else is optional.

### 4. Contact lookup (lines 63 to 67)

```ts
const { data: matchedContacts } = await adminClient
  .from("contacts")
  .select("id")
  .ilike("email", body.agent.agent_email)
  .limit(1);
```

Case-insensitive email match. If found, reuse the contact. If not,
create a new one.

### 5. New contact creation (lines 72 to 105)

```ts
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
```

Defaults:

- `tier: "P"` -- prospect tier
- `stage: "new"` -- the stage enum value for fresh contacts
- `source: "website"` -- intake form attribution
- `health_score: 30` -- warm-ish starting point, lower than Alex's
  manual set would be
- `type: "realtor"` -- assumed unless another intake type exists

Name split at line 74 handles single-word names by duplicating the
value into `firstName` and leaving `lastName` blank.

### 6. Listing data JSONB build (lines 108 to 127)

Defaults every field to an empty string, `state` to `"AZ"`, and
`key_features`/`gallery_images` to empty arrays. The full listing
object becomes the `material_requests.listing_data` JSONB column.

### 7. Title construction (lines 129 to 131)

```ts
const title = listing.address
  ? `Intake: ${body.agent.agent_name} - ${listing.address}`
  : `Intake: ${body.agent.agent_name} - ${body.situation || "general"}`;
```

### 8. `material_requests` insert (lines 134 to 153)

Fields set:

- `contact_id` (nullable if lookup failed silently)
- `title`
- `request_type: "design_help"`
- `status: "submitted"`
- `priority: "standard"`
- `source: "intake"`
- `listing_data` (JSONB)
- `submitter_name`, `submitter_email`, `submitter_phone`
- `submitted_at: new Date().toISOString()`
- `notes` (brokerage if provided)

Returns the new row id. Failure returns 500.

### 9. Line items fan-out (lines 163 to 177)

```ts
const items = body.products.map((product) => ({
  request_id: req.id,
  product_type: product,
  quantity: 1,
  description: null,
}));

const { error: itemsError } = await adminClient
  .from("material_request_items")
  .insert(items);
```

One row per product. Default quantity of 1, no description. Errors
are logged but do not fail the request (best effort).

### 10. First-touch interaction (lines 180 to 188)

```ts
if (isNewContact && contactId) {
  await adminClient.from("interactions").insert({
    user_id: ownerId,
    contact_id: contactId,
    type: "note",
    direction: "inbound",
    summary: `Submitted intake form (${body.situation || "general"}). Products requested: ${body.products.join(", ")}.`,
  });
}
```

Runs only for newly created contacts. The inbound note seeds the
interactions history so the materialized view starts computing a
recency score right away.

## Response shape

```ts
{ id: req.id, contactId, isNewContact }
```

Success is 201. All error paths return 500 except the required-field
check which returns 400.

## Dependencies

- `@/lib/supabase/admin` -- service-role client, bypasses RLS
- `@/lib/types` -- `ProductType` enum

## Why it uses the admin client

The intake endpoint is public (no auth cookie, no bearer token). A
service-role client is the only way to write into RLS-protected
tables. The middleware explicitly skips `/api/*` so the request never
hits the Supabase SSR auth cookie layer.

## Tables written

- `contacts` (new rows for first-time submitters)
- `material_requests` (always)
- `material_request_items` (one per selected product)
- `interactions` (first-touch note for new contacts only)

## Known constraints

Per `standing-rules.md` and `client-universe.md`:

- No hard deletes. All lookups filter `deleted_at IS NULL` implicitly
  via the service role (the policy is in the schema).
- Honeypot is the only spam defense; add a rate limit before scaling.
- `tier: "P"` assignment respects the tier convention (A/B/C/P
  canonical per 2026-04-10 reconciliation memo).
- `source: "website"` is a valid enum value per `types.ts`
  `ContactSource` union.
- Single-user system; multi-user rollout requires replacing
  `OWNER_USER_ID` env pin with session-derived ownership.

## Example curl

```bash
curl -X POST https://crm.example.com/api/intake \
  -H "Content-Type: application/json" \
  -d '{
    "products": ["flyer", "postcard"],
    "agent": {
      "agent_name": "Jane Doe",
      "agent_email": "jane@example.com",
      "agent_phone": "555-1212",
      "brokerage": "Keller Williams"
    },
    "listing": {
      "address": "123 Main St",
      "city": "Scottsdale",
      "state": "AZ",
      "zip": "85258",
      "price": "1250000",
      "bedrooms": "4",
      "bathrooms": "3"
    },
    "situation": "new listing"
  }'
```
