# Resend Email Integration

## What it does

Wraps the Resend email API with a single `sendEmail` helper and a
webhook receiver that bumps contact health scores when emails are
opened or clicked. This is the foundation for the Weekly Edge, Closing
Brief, Monthly Toolkit, Partner Spotlight, and onboarding drip
campaigns.

## Where it lives

- `/Users/alex/crm/src/lib/resend.ts` (38 lines) -- send helper
- `/Users/alex/crm/src/app/api/email/test/route.ts` (18 lines) -- smoke
  test route
- `/Users/alex/crm/src/app/api/webhooks/resend/route.ts` (62 lines) --
  webhook receiver

## Send helper (`lib/resend.ts`)

```ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const SAFE_RECIPIENT = process.env.RESEND_SAFE_RECIPIENT;

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, from, replyTo }: SendEmailParams) {
  const originalTo = to;

  // Safety lock: route all emails to the safe recipient when set
  if (SAFE_RECIPIENT) {
    const originalLabel = Array.isArray(originalTo) ? originalTo.join(", ") : originalTo;
    to = SAFE_RECIPIENT;
    subject = `[TEST -> ${originalLabel}] ${subject}`;
  }

  const { data, error } = await resend.emails.send({
    from: from ?? "Alex Hollien <alex@alexhollienco.com>",
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    replyTo,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
}
```

### Safety lock

Lines 18 to 23 implement a staging lock. When
`RESEND_SAFE_RECIPIENT` is set in env, every email gets redirected to
that address and the subject is prefixed with `[TEST -> original@addr]`.
This prevents accidental real sends during development. Remove the env
var in production.

### Default from

Line 26: `"Alex Hollien <alex@alexhollienco.com>"`. Override per call
via the `from` param. The sending domain `alexhollienco.com` must be
verified in the Resend dashboard before production sends.

## Test route (`api/email/test/route.ts`)

POST-only, no auth. Sends a hardcoded hello world to
`alex@alexhollienco.com`. Used once to verify the Resend API key. Not
intended for production.

```ts
export async function POST() {
  try {
    const data = await sendEmail({
      to: "alex@alexhollienco.com",
      subject: "Hello World",
      html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
```

## Webhook receiver (`api/webhooks/resend/route.ts`)

Receives Resend email events. Bumps `contacts.health_score` for
delivered, opened, and clicked events, then logs an interaction row
for opened/clicked events so the history shows the engagement.

### Score bumps (lines 9 to 13)

```ts
const SCORE_BUMPS: Record<string, number> = {
  "email.delivered": 1,
  "email.opened":    3,
  "email.clicked":   5,
};
```

Delivered is the smallest bump because it only proves the mail server
accepted the message. Opened requires a tracking pixel fetch (3
points). Clicked requires link interaction (5 points), the strongest
signal.

### Flow

1. Parse webhook payload (line 17)
2. Bail if event type is not in the accepted set (lines 20 to 22)
3. Extract recipient from `data.to[0]` (line 24)
4. Lookup the contact by email via service-role client, ordered by
   soft-delete filter (lines 27 to 33)
5. Bump `health_score` by the corresponding amount, capped at 100
   (lines 37 to 42)
6. For `opened`/`clicked`, insert an `interactions` row with
   `type: 'email'`, `direction: 'inbound'`, and a summary built from
   the event type and subject (lines 44 to 55)
7. Return `{ok, contact_id, bump}` or `{ok, skipped}`

### Auth gap

No signature validation on the webhook body. Anyone who knows the URL
can POST fake events. Before exposing in production, verify the
`svix-signature` header using the Resend webhook secret. Resend docs:
see their `@resend/node` SDK `webhooks.verify()` helper.

## Environment variables

| Var | Purpose | Required |
|---|---|---|
| `RESEND_API_KEY` | Resend API key | Yes |
| `RESEND_SAFE_RECIPIENT` | Redirect all sends to this address | No (dev only) |
| `NEXT_PUBLIC_SUPABASE_URL` | Service role base URL | Yes (webhook) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Yes (webhook) |

## Dependencies

- `resend` v6.10.0 (`package.json`)
- `@supabase/supabase-js` for the service-role client in the webhook
- Next.js `NextRequest` and `NextResponse` types

## Known constraints

- Email fonts per `brand.md`: Playfair Display + Inter (Google Fonts
  only). Typekit fonts silently fail in email clients.
- GAT co-brand rule: back-page on print only, never in email body
  (per `brand.md` and `standing-rules.md`).
- The webhook bump is additive to `contacts.health_score`. Alex's
  manual `rep_pulse` wins via `temperature.ts` coalescing when it is
  fresh (<= 14 days old).
- Soft delete only: the webhook lookup filters `deleted_at IS NULL`.

## Integration with the dashboard

Open/click bumps feed back into the dashboard's `agent_health` view
because:

1. The webhook writes `contacts.health_score` (the manual field)
2. The coalesce view `agent_health` prefers manual score when non-zero
3. `TaskListWidget` reads `agent_health` for the "going cold" and
   "proactive" buckets

Net effect: a cold contact who opens an email warms up in the
dashboard within a query refetch cycle.

## Example: sending a Weekly Edge issue

```ts
import { sendEmail } from "@/lib/resend";

await sendEmail({
  to: "julie@example.com",
  subject: "The Weekly Edge, Issue 47",
  html: weeklyEdgeHtml,
  replyTo: "alex@alexhollienco.com",
});
```

In production this loops over the campaign recipient list from
Supabase and awaits each send sequentially or via `Promise.all` with
concurrency control. The current send helper has no built-in rate
limiting.
