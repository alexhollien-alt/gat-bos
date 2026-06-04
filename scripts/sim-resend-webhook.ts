// scripts/sim-resend-webhook.ts -- POST a properly Svix-signed Resend webhook
// event to the local handler to verify open-house suppression end to end.
// Run: RESEND_WEBHOOK_SECRET=whsec_... pnpm exec tsx scripts/sim-resend-webhook.ts \
//        <provider_message_id> <recipient_email> <event_type>
import { createHmac } from "node:crypto";

const secret = process.env.RESEND_WEBHOOK_SECRET;
if (!secret) {
  console.error("RESEND_WEBHOOK_SECRET not set");
  process.exit(1);
}
const provId = process.argv[2];
const to = process.argv[3];
const evt = process.argv[4] || "email.bounced";

const secretBody = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
const key = Buffer.from(secretBody, "base64");

const payload = JSON.stringify({
  type: evt,
  data: { email_id: provId, to: [to], subject: "Sunday open house in Scottsdale" },
});
const svixId = "msg_local_test";
const ts = Math.floor(Date.now() / 1000).toString();
const signed = `${svixId}.${ts}.${payload}`;
const sig = createHmac("sha256", key).update(signed).digest("base64");

(async () => {
  const target = process.env.WEBHOOK_URL || "http://localhost:3001/api/webhooks/resend";
  const res = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "svix-id": svixId,
      "svix-timestamp": ts,
      "svix-signature": `v1,${sig}`,
    },
    body: payload,
  });
  console.log("HTTP", res.status, "->", await res.text());
})();
