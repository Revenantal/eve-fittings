import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/cookies", () => ({
  setOauthStateCookie: vi.fn()
}));

vi.mock("@/server/security/crypto", () => ({
  randomId: vi.fn()
}));

vi.mock("@/server/esi/client", () => ({
  getAuthorizeUrl: vi.fn()
}));

vi.mock("@/server/logging/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

import { setOauthStateCookie } from "@/server/auth/cookies";
import { getAuthorizeUrl } from "@/server/esi/client";
import { randomId } from "@/server/security/crypto";
import { GET } from "@/app/api/auth/login/route";

describe("GET /api/auth/login", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sets oauth state and redirects to sso", async () => {
    vi.mocked(randomId).mockReturnValue("state-123");
    vi.mocked(getAuthorizeUrl).mockReturnValue("https://login.eveonline.com/example");

    const response = await GET(new Request("http://localhost/api/auth/login"));

    expect(setOauthStateCookie).toHaveBeenCalledWith("state-123");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://login.eveonline.com/example");
  });
});