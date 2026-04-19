// Phase 1.5 Google Calendar client. Reuses the oauth_tokens row written by
// Gmail OAuth (provider='google'). Scope expansion in src/lib/gmail/oauth.ts
// adds calendar.events to the combined consent flow.
//
// Contract:
//   listEvents(timeMin, timeMax) -- inbound cron pull; GCal wins on merge.
//   insertEvent(input)           -- outbound write from dashboard; returns gcal_event_id.
//
// Retry/timeout match sync-client.ts: 10s timeout, 2 retries @ 1s/2s.
import { google, type calendar_v3 } from "googleapis";
import { getOAuth2Client, loadTokens, saveTokens, touchLastUsed } from "@/lib/gmail/oauth";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [1000, 2000];
const CALENDAR_ID = "primary";

export interface CalendarAttendee {
  email: string;
  displayName?: string | null;
  responseStatus?: string | null;
}

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  location?: string | null;
  attendees?: CalendarAttendee[];
}

export interface CalendarEventOutput {
  gcalEventId: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  location: string | null;
  attendees: CalendarAttendee[];
  updatedAt: Date;
}

async function getAuthedClient() {
  const stored = await loadTokens();
  if (!stored?.refreshToken) {
    throw new Error("No refresh token -- complete /api/auth/gmail/authorize first");
  }
  if (!stored.scopes.includes("https://www.googleapis.com/auth/calendar.events")) {
    throw new Error(
      "oauth_tokens missing calendar.events scope -- add it in GCP consent screen and re-run /api/auth/gmail/authorize",
    );
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

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`${label} timed out after ${DEFAULT_TIMEOUT_MS}ms`)),
            DEFAULT_TIMEOUT_MS,
          ),
        ),
      ]);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${label} failed`);
}

function parseTimestamp(ts: calendar_v3.Schema$EventDateTime | undefined): Date | null {
  if (!ts) return null;
  if (ts.dateTime) return new Date(ts.dateTime);
  if (ts.date) return new Date(`${ts.date}T00:00:00Z`);
  return null;
}

function mapEvent(e: calendar_v3.Schema$Event): CalendarEventOutput | null {
  if (!e.id) return null;
  const startAt = parseTimestamp(e.start ?? undefined);
  const endAt = parseTimestamp(e.end ?? undefined);
  if (!startAt || !endAt) return null;
  const attendees: CalendarAttendee[] = (e.attendees ?? []).map((a) => ({
    email: a.email ?? "",
    displayName: a.displayName ?? null,
    responseStatus: a.responseStatus ?? null,
  }));
  return {
    gcalEventId: e.id,
    title: e.summary ?? "(no title)",
    description: e.description ?? null,
    startAt,
    endAt,
    location: e.location ?? null,
    attendees,
    updatedAt: e.updated ? new Date(e.updated) : new Date(),
  };
}

export async function listEvents(timeMin: Date, timeMax: Date): Promise<CalendarEventOutput[]> {
  const auth = await getAuthedClient();
  const cal = google.calendar({ version: "v3", auth });
  const events: CalendarEventOutput[] = [];
  let pageToken: string | undefined;
  do {
    const res = await withRetry(
      () =>
        cal.events.list({
          calendarId: CALENDAR_ID,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 250,
          pageToken,
        }),
      "calendar.events.list",
    );
    for (const raw of res.data.items ?? []) {
      const mapped = mapEvent(raw);
      if (mapped) events.push(mapped);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  await touchLastUsed();
  return events;
}

export async function insertEvent(input: CalendarEventInput): Promise<CalendarEventOutput> {
  const auth = await getAuthedClient();
  const cal = google.calendar({ version: "v3", auth });
  const res = await withRetry(
    () =>
      cal.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: {
          summary: input.title,
          description: input.description ?? undefined,
          location: input.location ?? undefined,
          start: { dateTime: input.startAt.toISOString() },
          end: { dateTime: input.endAt.toISOString() },
          attendees: input.attendees?.map((a) => ({ email: a.email, displayName: a.displayName ?? undefined })),
        },
      }),
    "calendar.events.insert",
  );
  await touchLastUsed();
  const mapped = mapEvent(res.data);
  if (!mapped) throw new Error("calendar.events.insert returned no usable event");
  return mapped;
}
