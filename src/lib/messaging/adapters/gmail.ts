// Slice 4 Task 5 -- Gmail adapter.
// Reuses loadTokens() + getOAuth2Client() from src/lib/gmail/oauth.ts so
// the messaging layer rides the same OAuth path as the rest of the app.
// No GOOGLE_REFRESH_TOKEN read; that legacy env var is removed in Task 8.
//
// Composes a multipart/alternative RFC 5322 message with text/plain +
// text/html so mail clients without HTML rendering still get a readable
// body. base64url encodes the raw payload before handing it to
// gmail.users.messages.send with userId='me'.
import { google } from "googleapis";
import { getOAuth2Client, loadTokens, saveTokens, touchLastUsed } from "@/lib/gmail/oauth";
import { withRetry } from "@/lib/retry";
import type { AdapterSendInput, AdapterSendResult } from "../types";

const FROM_HEADER = "Alex Hollien <alex@alexhollienco.com>";

async function getAuthedClient() {
  const stored = await loadTokens();
  if (!stored?.refreshToken) {
    throw new Error("No Gmail refresh token -- complete /api/auth/gmail/authorize first");
  }
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: stored.accessToken ?? undefined,
    refresh_token: stored.refreshToken,
    expiry_date: stored.expiresAt ? stored.expiresAt.getTime() : undefined,
  });
  oauth2.on("tokens", (t) => {
    void saveTokens(t);
  });
  return oauth2;
}

function base64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildMimeMessage(input: AdapterSendInput): string {
  const boundary = `----=_msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const headers = [
    `From: ${FROM_HEADER}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const parts = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    input.text,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    input.html,
    `--${boundary}--`,
    "",
  ];
  return [...headers, "", ...parts].join("\r\n");
}

export async function sendViaGmail(input: AdapterSendInput): Promise<AdapterSendResult> {
  const auth = await getAuthedClient();
  const gmail = google.gmail({ version: "v1", auth });

  const raw = base64Url(Buffer.from(buildMimeMessage(input), "utf8"));

  const res = await withRetry(
    () =>
      gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      }),
    "messaging.gmail.send",
  );
  await touchLastUsed();

  const messageId = res.data.id;
  if (!messageId) throw new Error("Gmail send returned no message id");
  return { messageId };
}
