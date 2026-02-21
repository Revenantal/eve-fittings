import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/csrf", () => ({
  createCsrfToken: vi.fn()
}));

vi.mock("@/server/auth/cookies", () => ({
  clearOauthStateCookie: vi.fn(),
  getOauthStateCookie: vi.fn(),
  setCsrfCookie: vi.fn()
}));

vi.mock("@/server/auth/session-service", () => ({
  createUserSession: vi.fn()
}));

vi.mock("@/server/esi/client", () => ({
  exchangeCodeForTokens: vi.fn(),
  verifyAccessToken: vi.fn()
}));

vi.mock("@/lib/fits/service", () => ({
  syncCharacterFittings: vi.fn()
}));

vi.mock("@/server/logging/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

import { syncCharacterFittings } from "@/lib/fits/service";
import { createCsrfToken } from "@/server/auth/csrf";
import { clearOauthStateCookie, getOauthStateCookie, setCsrfCookie } from "@/server/auth/cookies";
import { exchangeCodeForTokens, verifyAccessToken } from "@/server/esi/client";
import { createUserSession } from "@/server/auth/session-service";
import { GET } from "@/app/api/auth/callback/route";

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 400 when code or state is missing", async () => {
    const response = await GET(new NextRequest("http://localhost/api/auth/callback"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Missing code/state" });
  });

  it("returns 400 when oauth state does not match", async () => {
    vi.mocked(getOauthStateCookie).mockResolvedValue("expected");

    const response = await GET(new NextRequest("http://localhost/api/auth/callback?code=abc&state=wrong"));

    expect(clearOauthStateCookie).toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid OAuth state" });
  });

  it("completes login and redirects on success", async () => {
    vi.mocked(getOauthStateCookie).mockResolvedValue("expected");
    vi.mocked(createCsrfToken).mockReturnValue("csrf-1");
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: "access",
      token_type: "Bearer",
      expires_in: 1200,
      refresh_token: "refresh"
    });
    vi.mocked(verifyAccessToken).mockResolvedValue({
      CharacterID: 1337,
      CharacterName: "Pilot",
      ExpiresOn: "2026-02-20T00:00:00Z",
      Scopes: "esi-fittings.read_fittings.v1 esi-fittings.write_fittings.v1",
      TokenType: "Character",
      CharacterOwnerHash: "hash",
      IntellectualProperty: "EVE"
    });
    vi.mocked(syncCharacterFittings).mockResolvedValue({ count: 2, syncedAt: "2026-02-20T00:00:00Z" });

    const response = await GET(new NextRequest("http://localhost/api/auth/callback?code=abc&state=expected"));

    expect(createUserSession).toHaveBeenCalledWith(1337, "access", 1200, "refresh");
    expect(setCsrfCookie).toHaveBeenCalledWith("csrf-1");
    expect(syncCharacterFittings).toHaveBeenCalledWith(1337, "access");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("still redirects if initial sync fails", async () => {
    vi.mocked(getOauthStateCookie).mockResolvedValue("expected");
    vi.mocked(createCsrfToken).mockReturnValue("csrf-1");
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: "access",
      token_type: "Bearer",
      expires_in: 1200,
      refresh_token: "refresh"
    });
    vi.mocked(verifyAccessToken).mockResolvedValue({
      CharacterID: 1337,
      CharacterName: "Pilot",
      ExpiresOn: "2026-02-20T00:00:00Z",
      Scopes: "esi-fittings.read_fittings.v1 esi-fittings.write_fittings.v1",
      TokenType: "Character",
      CharacterOwnerHash: "hash",
      IntellectualProperty: "EVE"
    });
    vi.mocked(syncCharacterFittings).mockRejectedValue(new Error("429"));

    const response = await GET(new NextRequest("http://localhost/api/auth/callback?code=abc&state=expected"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("returns 500 when token exchange fails", async () => {
    vi.mocked(getOauthStateCookie).mockResolvedValue("expected");
    vi.mocked(exchangeCodeForTokens).mockRejectedValue(new Error("boom"));

    const response = await GET(new NextRequest("http://localhost/api/auth/callback?code=abc&state=expected"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: "OAuth callback failed" });
  });
});
