import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/esi-context", () => ({
  requireAuthenticatedEsiContext: vi.fn()
}));

vi.mock("@/lib/fits/service", () => ({
  listGroupedFittings: vi.fn()
}));

vi.mock("@/server/logging/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

import { listGroupedFittings } from "@/lib/fits/service";
import { GET } from "@/app/api/fits/route";
import { requireAuthenticatedEsiContext } from "@/server/auth/esi-context";

describe("GET /api/fits", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns grouped fittings with sync status markers", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 77,
      accessToken: "token"
    });
    vi.mocked(listGroupedFittings).mockResolvedValue({
      updatedAt: "2026-02-20T00:00:00.000Z",
      groups: [
        {
          shipClassName: "Cruiser",
          factions: [
            {
              shipFactionName: "Caldari State",
              ships: [
                {
                  shipTypeId: 621,
                  shipTypeName: "Caracal",
                  fittings: [
                    { fittingId: 10, name: "PvE", isSyncedToEve: true },
                    { fittingId: 11, name: "Legacy", isSyncedToEve: false }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    const response = await GET(new Request("http://localhost/api/fits?q=pve"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      updatedAt: "2026-02-20T00:00:00.000Z",
      groups: [
        {
          shipClassName: "Cruiser",
          factions: [
            {
              shipFactionName: "Caldari State",
              ships: [
                {
                  shipTypeId: 621,
                  fittings: [
                    { fittingId: 10, isSyncedToEve: true },
                    { fittingId: 11, isSyncedToEve: false }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });
    expect(listGroupedFittings).toHaveBeenCalledWith(77, "pve");
  });

  it("returns 401 when auth context fails", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockRejectedValue(new Error("Not authenticated"));

    const response = await GET(new Request("http://localhost/api/fits"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });
});
