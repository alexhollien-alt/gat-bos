// OAuth flow helpers for Phase 1.3.1 Gmail MVP.
// Stores encrypted tokens in public.oauth_tokens (user_id='alex', provider='google').
// CSRF protection via HMAC-signed state token (10-min TTL).
import { google } from "googleapis";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { encrypt, decrypt } from "@/lib/crypto/vault";

// Phase 1.3.1 Gmail scopes + Phase 1.5 Calendar bidirectional sync scope.
// Single Google OAuth consent flow powers both. Alex must add calendar.events
// to the GCP consent screen and re-run /api/auth/gmail/authorize so the
// oauth_tokens.scopes array reflects the union before calendar API calls land.
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
];

const USER_ID = "alex";
const PROVIDER = "google";
const STATE_TTL_MS = 10 * 60 * 1000;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    requireEnv("GMAIL_CLIENT_ID"),
    requireEnv("GMAIL_CLIENT_SECRET"),
    requireEnv("GMAIL_REDIRECT_URI"),
  );
}

export function createState(): string {
  const nonce = randomBytes(16).toString("hex");
  const ts = Date.now().toString();
  const hmac = createHmac("sha256", requireEnv("OAUTH_ENCRYPTION_KEY"))
    .update(`${nonce}.${ts}`)
    .digest("hex");
  return `${nonce}.${ts}.${hmac}`;
}

export function verifyState(state: string): boolean {
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [nonce, ts, hmac] = parts;
  const age = Date.now() - Number(ts);
  if (!Number.isFinite(age) || age < 0 || age > STATE_TTL_MS) return false;
  const expected = createHmac("sha256", requireEnv("OAUTH_ENCRYPTION_KEY"))
    .update(`${nonce}.${ts}`)
    .digest("hex");
  try {
    const a = Buffer.from(hmac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildAuthorizeUrl(): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state: createState(),
    include_granted_scopes: true,
  });
}

export async function exchangeCode(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
}

export async function saveTokens(tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string | null;
}) {
  const access = tokens.access_token ?? null;
  const refresh = tokens.refresh_token ?? null;
  const expiresIso = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;
  const scopes = tokens.scope ? tokens.scope.split(" ") : [];

  const payload: Record<string, unknown> = {
    user_id: USER_ID,
    provider: PROVIDER,
    access_token: access ? encrypt(access) : null,
    expires_at: expiresIso,
    scopes,
    last_used_at: new Date().toISOString(),
  };

  if (refresh) payload.refresh_token = encrypt(refresh);

  const { error } = await adminClient
    .from("oauth_tokens")
    .upsert(payload, { onConflict: "user_id,provider" });

  if (error) throw new Error(`oauth_tokens upsert failed: ${error.message}`);
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const { data, error } = await adminClient
    .from("oauth_tokens")
    .select("access_token, refresh_token, expires_at, scopes")
    .eq("user_id", USER_ID)
    .eq("provider", PROVIDER)
    .maybeSingle();

  if (error) throw new Error(`oauth_tokens read failed: ${error.message}`);
  if (!data) return null;

  return {
    accessToken: data.access_token ? decrypt(data.access_token) : null,
    refreshToken: data.refresh_token ? decrypt(data.refresh_token) : null,
    expiresAt: data.expires_at ? new Date(data.expires_at) : null,
    scopes: Array.isArray(data.scopes) ? data.scopes : [],
  };
}

export async function touchLastUsed() {
  await adminClient
    .from("oauth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", USER_ID)
    .eq("provider", PROVIDER);
}
