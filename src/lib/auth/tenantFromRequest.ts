// src/lib/auth/tenantFromRequest.ts
//
// Slice 7A: single entry point for resolving the tenant (user + account, or
// explicit service context) of any incoming request. Replaces the implicit
// "alex@alexhollienco.com" / OWNER_USER_ID assumptions scattered across
// route handlers.
//
// Service-role contract: when kind === 'service', accountId is intentionally
// absent. Service-role callers (cron, webhook, intake, background) use
// adminClient and BYPASS RLS by design. Those callers must scope rows
// explicitly via `.eq('account_id', ...)` or equivalent. They cannot defer
// to RLS for tenant isolation.
//
// Failure modes are explicit (no_session, no_account, invalid_service_token,
// ambiguous_context). No silent fallbacks. No "assume Alex" defaults.

import type { NextRequest } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { verifyCronSecret } from "@/lib/api-auth";

export type TenantContext =
  | { kind: "user"; userId: string; accountId: string }
  | { kind: "service"; reason: "cron" | "webhook" | "intake" | "background" };

export type TenantErrorCode =
  | "no_session"
  | "no_account"
  | "invalid_service_token"
  | "ambiguous_context";

export class TenantResolutionError extends Error {
  code: TenantErrorCode;
  constructor(code: TenantErrorCode, message: string) {
    super(message);
    this.name = "TenantResolutionError";
    this.code = code;
  }
}

export interface TenantFromRequestOptions {
  service?: "cron" | "webhook" | "intake" | "background";
  // Pluggable verifier for non-cron service paths. The route's existing
  // HMAC/token verifier is passed in; tenantFromRequest itself does not know
  // about Svix, Gmail watch, INTERNAL_API_TOKEN, etc.
  verifyServiceToken?: () => boolean | Promise<boolean>;
}

// Test-only override hook. Stripped (no-op) in production builds.
type Override =
  | { type: "ctx"; value: TenantContext }
  | { type: "error"; value: TenantResolutionError }
  | null;

let __testOverride: Override = null;

export function __setTenantOverride(
  next:
    | TenantContext
    | TenantResolutionError
    | null
): void {
  if (process.env.NODE_ENV === "production") return;
  if (next === null) {
    __testOverride = null;
    return;
  }
  if (next instanceof TenantResolutionError) {
    __testOverride = { type: "error", value: next };
    return;
  }
  __testOverride = { type: "ctx", value: next };
}

export async function tenantFromRequest(
  req: Request | NextRequest,
  opts?: TenantFromRequestOptions
): Promise<TenantContext> {
  if (process.env.NODE_ENV !== "production" && __testOverride !== null) {
    if (__testOverride.type === "error") throw __testOverride.value;
    return __testOverride.value;
  }

  const service = opts?.service;

  if (service === "cron") {
    if (!verifyCronSecret(req)) {
      throw new TenantResolutionError(
        "invalid_service_token",
        "cron secret missing or invalid"
      );
    }
    return { kind: "service", reason: "cron" };
  }

  if (service === "webhook" || service === "intake" || service === "background") {
    const verifier = opts?.verifyServiceToken;
    if (!verifier) {
      throw new TenantResolutionError(
        "invalid_service_token",
        `${service} path requires verifyServiceToken in opts`
      );
    }
    const ok = await verifier();
    if (!ok) {
      throw new TenantResolutionError(
        "invalid_service_token",
        `${service} signature/token invalid`
      );
    }
    return { kind: "service", reason: service };
  }

  // Authenticated user path (default).
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new TenantResolutionError("no_session", "no authenticated user");
  }

  const { data: account, error: accountErr } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (accountErr) {
    throw new TenantResolutionError(
      "no_account",
      `account lookup failed: ${accountErr.message}`
    );
  }
  if (!account) {
    throw new TenantResolutionError(
      "no_account",
      "user has no account assigned"
    );
  }

  return { kind: "user", userId: user.id, accountId: account.id };
}
