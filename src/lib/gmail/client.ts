// src/lib/gmail/client.ts
import { google } from "googleapis";

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Gmail OAuth env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN"
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "https://developers.google.com/oauthplayground"
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export interface GmailThread {
  threadId: string;
  subject: string;
  senderEmail: string;
  senderName: string;
  snippet: string;
  receivedAt: Date;
}

export async function fetchUnreadThreads(maxResults = 50): Promise<GmailThread[]> {
  const gmail = google.gmail({ version: "v1", auth: getOAuth2Client() });

  const listRes = await gmail.users.threads.list({
    userId: "me",
    q: "in:inbox is:unread newer_than:2d",
    maxResults,
  });

  const threads = listRes.data.threads ?? [];
  if (threads.length === 0) return [];

  const results: GmailThread[] = [];

  for (const thread of threads) {
    if (!thread.id) continue;

    const detail = await gmail.users.threads.get({
      userId: "me",
      id: thread.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });

    const firstMessage = detail.data.messages?.[0];
    if (!firstMessage) continue;

    const headers = firstMessage.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

    const fromRaw = getHeader("From");
    const subject = getHeader("Subject") || "(no subject)";
    const dateRaw = getHeader("Date");

    // Parse "Name <email@domain>" or bare "email@domain"
    const emailMatch = fromRaw.match(/<([^>]+)>/);
    const senderEmail = emailMatch ? emailMatch[1].trim() : fromRaw.trim();
    const senderName = emailMatch
      ? fromRaw.replace(/<[^>]+>/, "").trim().replace(/^"|"$/g, "")
      : senderEmail;

    const snippet = detail.data.snippet ?? "";
    const receivedAt = dateRaw ? new Date(dateRaw) : new Date();

    results.push({ threadId: thread.id, subject, senderEmail, senderName, snippet, receivedAt });
  }

  return results;
}
