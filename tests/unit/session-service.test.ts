import { beforeEach, describe, expect, it, vi } from "vitest";

const createSessionMock = vi.fn();
const deleteSessionMock = vi.fn();
const getSessionMock = vi.fn();
const encryptStringMock = vi.fn((value: string) => `enc(${value})`);
const decryptStringMock = vi.fn((value: string) => value.replace(/^enc\(/, "").replace(/\)$/, ""));
const randomIdMock = vi.fn(() => "session-1");
const setSessionCookieMock = vi.fn();
const getSessionIdFromCookieMock = vi.fn();
const clearSessionCookieMock = vi.fn();
const clearCsrfCookieMock = vi.fn();
const refreshAccessTokenMock = vi.fn();
const loggerWarnMock = vi.fn();

vi.mock("@/server/auth/session-store", () => ({
  createSession: createSessionMock,
  deleteSession: deleteSessionMock,
  getSession: getSessionMock
}));

vi.mock("@/server/security/crypto", () => ({
  encryptString: encryptStringMock,
  decryptString: decryptStringMock,
  randomId: randomIdMock
}));

vi.mock("@/server/auth/cookies", () => ({
  setSessionCookie: setSessionCookieMock,
  getSessionIdFromCookie: getSessionIdFromCookieMock,
  clearSessionCookie: clearSessionCookieMock,
  clearCsrfCookie: clearCsrfCookieMock
}));

vi.mock("@/server/esi/client", () => ({
  refreshAccessToken: refreshAccessTokenMock
}));

vi.mock("@/server/logging/logger", () => ({
  logger: {
    warn: loggerWarnMock
  }
}));

describe("session-service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates a session with cached access token", async () => {
    const { createUserSession } = await import("@/server/auth/session-service");

    const sessionId = await createUserSession(1337, "access-token", 1200, "refresh-token");

    expect(sessionId).toBe("session-1");
    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        characterId: 1337,
        encryptedRefreshToken: "enc(refresh-token)",
        encryptedAccessToken: "enc(access-token)"
      })
    );
    expect(createSessionMock.mock.calls[0][0].accessTokenExpiresAt).toEqual(expect.any(String));
    expect(setSessionCookieMock).toHaveBeenCalledWith("session-1");
  });

  it("reuses cached access token when session token has not expired", async () => {
    getSessionMock.mockResolvedValue({
      sessionId: "session-1",
      characterId: 1337,
      encryptedRefreshToken: "enc(refresh-token)",
      encryptedAccessToken: "enc(cached-access)",
      accessTokenExpiresAt: "2099-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });

    const { getAccessTokenForSession } = await import("@/server/auth/session-service");
    const result = await getAccessTokenForSession("session-1");

    expect(result).toEqual({ accessToken: "cached-access", characterId: 1337 });
    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("refreshes and rotates session when cached access token is stale", async () => {
    getSessionMock.mockResolvedValue({
      sessionId: "session-1",
      characterId: 1337,
      encryptedRefreshToken: "enc(refresh-token)",
      encryptedAccessToken: "enc(old-access)",
      accessTokenExpiresAt: "2000-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    refreshAccessTokenMock.mockResolvedValue({
      access_token: "new-access",
      token_type: "Bearer",
      expires_in: 1200,
      refresh_token: "new-refresh"
    });

    const { getAccessTokenForSession } = await import("@/server/auth/session-service");
    const result = await getAccessTokenForSession("session-1");

    expect(result).toEqual({ accessToken: "new-access", characterId: 1337 });
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(refreshAccessTokenMock).toHaveBeenCalledWith("refresh-token");
    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        characterId: 1337,
        createdAt: "2026-01-01T00:00:00.000Z",
        encryptedRefreshToken: "enc(new-refresh)",
        encryptedAccessToken: "enc(new-access)"
      })
    );
  });
});
