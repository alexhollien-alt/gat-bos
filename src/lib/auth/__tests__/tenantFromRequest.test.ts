import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the Supabase server client. Each test wires fresh return values
// for auth.getUser() and the accounts lookup.
const getUserMock = vi.fn<() => Promise<{ data: { user: unknown } }>>();
const accountsMaybeSingleMock =
  vi.fn<() => Promise<{ data: unknown; error: unknown }>>();
const accountsIsMock = vi.fn(() => ({ maybeSingle: accountsMaybeSingleMock }));
const accountsEqMock = vi.fn(() => ({ is: accountsIsMock }));
const accountsSelectMock = vi.fn(() => ({ eq: accountsEqMock }));
const fromMock = vi.fn((_table: string) => ({ select: accountsSelectMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => fromMock(table),
  }),
}));

const verifyCronSecretMock = vi.fn<(req: Request) => boolean>();
vi.mock("@/lib/api-auth", () => ({
  verifyCronSecret: (req: Request) => verifyCronSecretMock(req),
}));

import {
  tenantFromRequest,
  TenantResolutionError,
} from "../tenantFromRequest";

beforeEach(() => {
  getUserMock.mockReset();
  accountsMaybeSingleMock.mockReset();
  accountsIsMock.mockClear();
  accountsEqMock.mockClear();
  accountsSelectMock.mockClear();
  fromMock.mockClear();
  verifyCronSecretMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

const buildRequest = (headers: Record<string, string> = {}) =>
  new Request("https://gat-bos.test/api/anything", { headers });

describe("tenantFromRequest -- user path", () => {
  it("authenticated user with valid account returns kind=user with userId and accountId", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "alex@alexhollien.test" } },
    });
    accountsMaybeSingleMock.mockResolvedValueOnce({
      data: { id: "account-abc" },
      error: null,
    });

    const ctx = await tenantFromRequest(buildRequest());

    expect(ctx).toEqual({
      kind: "user",
      userId: "user-123",
      accountId: "account-abc",
    });
    expect(fromMock).toHaveBeenCalledWith("accounts");
    expect(accountsEqMock).toHaveBeenCalledWith("owner_user_id", "user-123");
  });

  it("authenticated user with no account row throws no_account", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-orphan" } },
    });
    accountsMaybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(tenantFromRequest(buildRequest())).rejects.toMatchObject({
      name: "TenantResolutionError",
      code: "no_account",
    });
  });

  it("no session throws no_session", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });

    let caught: unknown;
    try {
      await tenantFromRequest(buildRequest());
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TenantResolutionError);
    expect((caught as TenantResolutionError).code).toBe("no_session");
    // accounts lookup must not run when there's no session.
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("tenantFromRequest -- cron path", () => {
  it("valid CRON_SECRET returns kind=service reason=cron", async () => {
    verifyCronSecretMock.mockReturnValueOnce(true);
    const ctx = await tenantFromRequest(buildRequest(), { service: "cron" });
    expect(ctx).toEqual({ kind: "service", reason: "cron" });
    // cron path must not touch user/account resolution.
    expect(getUserMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("invalid CRON_SECRET throws invalid_service_token", async () => {
    verifyCronSecretMock.mockReturnValueOnce(false);
    await expect(
      tenantFromRequest(buildRequest(), { service: "cron" })
    ).rejects.toMatchObject({
      name: "TenantResolutionError",
      code: "invalid_service_token",
    });
  });
});

describe("tenantFromRequest -- webhook path", () => {
  it("valid HMAC (verifyServiceToken=true) returns kind=service reason=webhook", async () => {
    const verifyServiceToken = vi.fn().mockResolvedValue(true);
    const ctx = await tenantFromRequest(buildRequest(), {
      service: "webhook",
      verifyServiceToken,
    });
    expect(ctx).toEqual({ kind: "service", reason: "webhook" });
    expect(verifyServiceToken).toHaveBeenCalledTimes(1);
    expect(getUserMock).not.toHaveBeenCalled();
  });
});
