// Phase 1.3.1 Gmail sync client. DB-backed tokens.
// Separate from legacy src/lib/gmail/client.ts which powers /api/inbox/scan on GOOGLE_* env vars.
import { google, type gmail_v1 } from "googleapis";
import { getOAuth2Client, loadTokens, saveTokens, touchLastUsed } from "./oauth";
import { withRetry } from "@/lib/retry";

export interface SyncMessage {
  gmailId: string;
  threadId: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  bodyPlain: string;
  bodyHtml: string;
  snippet: string;
  labels: string[];
  receivedAt: Date;
  isUnread: boolean;
}

async function getAuthedClient() {
  const stored = await loadTokens();
  if (!stored?.refreshToken) {
    throw new Error("No refresh token -- complete /api/auth/gmail/authorize first");
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

function decodeBody(data?: string | null): string {
  if (!data) return "";
  return Buffer.from(data, "base64url").toString("utf8");
}

function collectParts(payload: gmail_v1.Schema$MessagePart | undefined): {
  plain: string;
  html: string;
} {
  const acc = { plain: "", html: "" };
  if (!payload) return acc;
  const walk = (part: gmail_v1.Schema$MessagePart) => {
    const mime = part.mimeType ?? "";
    const bodyData = part.body?.data ?? null;
    if (mime === "text/plain" && bodyData) acc.plain += decodeBody(bodyData);
    else if (mime === "text/html" && bodyData) acc.html += decodeBody(bodyData);
    for (const sub of part.parts ?? []) walk(sub);
  };
  walk(payload);
  return acc;
}

function parseFromHeader(raw: string): { email: string; name: string } {
  const match = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: raw.trim(), email: raw.trim() };
}

export async function listUnreadSince(sinceHours: number): Promise<string[]> {
  const auth = await getAuthedClient();
  const gmail = google.gmail({ version: "v1", auth });
  const days = Math.max(1, Math.ceil(sinceHours / 24));
  const q = `is:unread newer_than:${days}d`;
  const res = await withRetry(
    () => gmail.users.messages.list({ userId: "me", q, maxResults: 50 }),
    "gmail.messages.list",
  );
  await touchLastUsed();
  return (res.data.messages ?? []).map((m) => m.id!).filter(Boolean);
}

export async function markReadAndArchive(gmailId: string): Promise<void> {
  const auth = await getAuthedClient();
  const gmail = google.gmail({ version: "v1", auth });
  await withRetry(
    () =>
      gmail.users.messages.modify({
        userId: "me",
        id: gmailId,
        requestBody: { removeLabelIds: ["UNREAD", "INBOX"] },
      }),
    `gmail.messages.modify(${gmailId})`,
  );
  await touchLastUsed();
}

export async function createGmailDraft(input: {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyPlain: string;
  threadId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
}): Promise<{ draftId: string; messageId: string }> {
  const auth = await getAuthedClient();
  const gmail = google.gmail({ version: "v1", auth });

  const headers: string[] = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
  ];
  if (input.inReplyTo) headers.push(`In-Reply-To: ${input.inReplyTo}`);
  if (input.references) headers.push(`References: ${input.references}`);

  const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${input.bodyHtml}`, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await withRetry(
    () =>
      gmail.users.drafts.create({
        userId: "me",
        requestBody: {
          message: {
            raw,
            threadId: input.threadId ?? undefined,
          },
        },
      }),
    "gmail.drafts.create",
  );
  await touchLastUsed();

  const draftId = res.data.id;
  const messageId = res.data.message?.id;
  if (!draftId || !messageId) throw new Error("Gmail draft creation returned no id");
  return { draftId, messageId };
}

export async function fetchMessage(id: string): Promise<SyncMessage | null> {
  const auth = await getAuthedClient();
  const gmail = google.gmail({ version: "v1", auth });
  const res = await withRetry(
    () => gmail.users.messages.get({ userId: "me", id, format: "full" }),
    `gmail.messages.get(${id})`,
  );
  const m = res.data;
  if (!m.id) return null;

  const headers = m.payload?.headers ?? [];
  const h = (name: string) =>
    headers.find((x) => x.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

  const { name, email } = parseFromHeader(h("From"));
  const subject = h("Subject") || "(no subject)";
  const dateHeader = h("Date");
  const receivedAt = dateHeader
    ? new Date(dateHeader)
    : m.internalDate
      ? new Date(Number(m.internalDate))
      : new Date();

  const { plain, html } = collectParts(m.payload ?? undefined);
  const labels = m.labelIds ?? [];

  return {
    gmailId: m.id,
    threadId: m.threadId ?? "",
    fromEmail: email,
    fromName: name,
    subject,
    bodyPlain: plain,
    bodyHtml: html,
    snippet: m.snippet ?? "",
    labels,
    receivedAt,
    isUnread: labels.includes("UNREAD"),
  };
}
