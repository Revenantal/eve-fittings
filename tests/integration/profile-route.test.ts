import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/esi-context", () => ({
  requireAuthenticatedEsiContext: vi.fn()
}));

vi.mock("@/lib/profile/service", () => ({
  loadPlayerProfile: vi.fn()
}));

vi.mock("@/server/logging/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

import { loadPlayerProfile } from "@/lib/profile/service";
import { GET } from "@/app/api/profile/route";
import { requireAuthenticatedEsiContext } from "@/server/auth/esi-context";

describe("GET /api/profile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns profile data when authenticated", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 1337,
      accessToken: "token"
    });
    vi.mocked(loadPlayerProfile).mockResolvedValue({
      characterId: 1337,
      characterName: "Pilot",
      corporationName: "Acme Corp",
      allianceName: null,
      portraitUrl: "https://images.evetech.net/characters/1337/portrait?size=128"
    });

    const response = await GET(new Request("http://localhost/api/profile"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      characterId: 1337,
      characterName: "Pilot",
      corporationName: "Acme Corp",
      allianceName: null
    });
    expect(loadPlayerProfile).toHaveBeenCalledWith(1337, "token");
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockRejectedValue(new Error("Not authenticated"));

    const response = await GET(new Request("http://localhost/api/profile"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });
});
