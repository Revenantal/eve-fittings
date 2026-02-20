import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage/fits-store", () => ({
  listStoredFittings: vi.fn(),
  tryReadIndex: vi.fn(),
  writeFittings: vi.fn(),
  readFitting: vi.fn(),
  readFittingLastModified: vi.fn(),
  deleteStoredFitting: vi.fn()
}));

vi.mock("@/lib/ship-types/cache", () => ({
  resolveShipGroupingMetadata: vi.fn(),
  resolveShipTypeName: vi.fn(),
  resolveTypeName: vi.fn()
}));

import { listGroupedFittings } from "@/lib/fits/service";
import { listStoredFittings, tryReadIndex } from "@/lib/storage/fits-store";
import { resolveShipGroupingMetadata } from "@/lib/ship-types/cache";

describe("listGroupedFittings search", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("matches a fitting by fitting name", async () => {
    vi.mocked(tryReadIndex).mockResolvedValue({
      characterId: 100,
      updatedAt: "2026-02-20T00:00:00.000Z",
      fittings: [{ fittingId: 10, name: "Alpha Fit", shipTypeId: 621, path: "p1" }]
    });
    vi.mocked(listStoredFittings).mockResolvedValue([
      { fittingId: 10, name: "Alpha Fit", shipTypeId: 621 },
      { fittingId: 11, name: "Shield Setup", shipTypeId: 24698 }
    ]);
    vi.mocked(resolveShipGroupingMetadata).mockImplementation(async (shipTypeId: number) => {
      if (shipTypeId === 621) {
        return {
          shipClassName: "Cruiser",
          shipFactionName: "Caldari State",
          shipTypeId: 621,
          shipTypeName: "Caracal"
        };
      }
      return {
        shipClassName: "Battlecruiser",
        shipFactionName: "Caldari State",
        shipTypeId: 24698,
        shipTypeName: "Drake"
      };
    });

    const result = await listGroupedFittings(100, "alpha");

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.factions[0]?.ships[0]?.fittings).toMatchObject([{ fittingId: 10, name: "Alpha Fit" }]);
  });

  it("matches a fitting by ship name even when fitting name does not match", async () => {
    vi.mocked(tryReadIndex).mockResolvedValue({
      characterId: 100,
      updatedAt: "2026-02-20T00:00:00.000Z",
      fittings: [{ fittingId: 10, name: "Alpha Fit", shipTypeId: 621, path: "p1" }]
    });
    vi.mocked(listStoredFittings).mockResolvedValue([
      { fittingId: 10, name: "Alpha Fit", shipTypeId: 621 },
      { fittingId: 11, name: "Armor Setup", shipTypeId: 24698 }
    ]);
    vi.mocked(resolveShipGroupingMetadata).mockImplementation(async (shipTypeId: number) => {
      if (shipTypeId === 621) {
        return {
          shipClassName: "Cruiser",
          shipFactionName: "Caldari State",
          shipTypeId: 621,
          shipTypeName: "Caracal"
        };
      }
      return {
        shipClassName: "Battlecruiser",
        shipFactionName: "Caldari State",
        shipTypeId: 24698,
        shipTypeName: "Drake"
      };
    });

    const result = await listGroupedFittings(100, "caracal");

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.factions[0]?.ships[0]).toMatchObject({
      shipTypeName: "Caracal",
      fittings: [{ fittingId: 10, name: "Alpha Fit" }]
    });
  });

  it("does not match non-contiguous fuzzy patterns", async () => {
    vi.mocked(tryReadIndex).mockResolvedValue({
      characterId: 100,
      updatedAt: "2026-02-20T00:00:00.000Z",
      fittings: [{ fittingId: 10, name: "Alpha Fit", shipTypeId: 621, path: "p1" }]
    });
    vi.mocked(listStoredFittings).mockResolvedValue([{ fittingId: 10, name: "Alpha Fit", shipTypeId: 621 }]);
    vi.mocked(resolveShipGroupingMetadata).mockResolvedValue({
      shipClassName: "Cruiser",
      shipFactionName: "Caldari State",
      shipTypeId: 621,
      shipTypeName: "Caracal"
    });

    const result = await listGroupedFittings(100, "crc");
    expect(result.groups).toEqual([]);
  });
});
