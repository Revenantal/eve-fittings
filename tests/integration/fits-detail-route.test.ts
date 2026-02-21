import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/esi-context", () => ({
  requireAuthenticatedEsiContext: vi.fn()
}));

vi.mock("@/lib/fits/service", () => ({
  getFittingDetail: vi.fn(),
  deleteStoredFittingPermanently: vi.fn(),
  getFittingEft: vi.fn(),
  getFittingPriceEstimate: vi.fn(),
  getFittingLastModified: vi.fn()
}));

vi.mock("@/lib/storage/lock", () => ({
  withCharacterLock: vi.fn(async (_characterId: number, fn: () => Promise<unknown>) => fn())
}));

vi.mock("@/server/auth/csrf", () => ({
  validateCsrfHeader: vi.fn()
}));

import {
  deleteStoredFittingPermanently,
  getFittingDetail,
  getFittingEft,
  getFittingLastModified,
  getFittingPriceEstimate
} from "@/lib/fits/service";
import { withCharacterLock } from "@/lib/storage/lock";
import { validateCsrfHeader } from "@/server/auth/csrf";
import { requireAuthenticatedEsiContext } from "@/server/auth/esi-context";
import { DELETE, GET } from "@/app/api/fits/[fittingId]/route";
import { GET as GET_BUNDLE } from "@/app/api/fits/[fittingId]/bundle/route";
import { GET as GET_EFT } from "@/app/api/fits/[fittingId]/eft/route";
import { GET as GET_PRICE } from "@/app/api/fits/[fittingId]/price/route";

describe("GET /api/fits/[fittingId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(withCharacterLock).mockImplementation(async (_characterId: number, fn: () => Promise<unknown>) => fn());
  });

  it("returns 400 for invalid fitting id", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "bad" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid fitting id" });
  });

  it("returns fitting details for valid requests", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    vi.mocked(getFittingDetail).mockResolvedValue({
      fitting: {
        description: "",
        fitting_id: 10,
        items: [],
        name: "Fit A",
        ship_type_id: 123
      },
      canRemoveFromEve: true,
      canSyncToEve: false,
      shipTypeId: 123,
      shipTypeName: "Caracal",
      fittingName: "Fit A",
      itemTypeNames: {},
      itemNamesByFlag: {}
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      fitting: { fitting_id: 10, name: "Fit A", ship_type_id: 123 },
      canRemoveFromEve: true,
      canSyncToEve: false,
      shipTypeId: 123,
      shipTypeName: "Caracal",
      fittingName: "Fit A",
      itemTypeNames: {},
      itemNamesByFlag: {}
    });
    expect(getFittingDetail).toHaveBeenCalledWith(100, 10);
  });

  it("returns 404 when detail file is missing", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    const missing = new Error("missing") as NodeJS.ErrnoException;
    missing.code = "ENOENT";
    vi.mocked(getFittingDetail).mockRejectedValue(missing);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Fitting not found" });
  });

  it("returns 401 when authentication fails", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockRejectedValue(new Error("Session not found"));

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });

  it("returns 500 for unexpected lookup failures", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    vi.mocked(getFittingDetail).mockRejectedValue(new Error("EPERM: operation not permitted"));

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: "Unable to load fitting details" });
  });
});

describe("DELETE /api/fits/[fittingId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(withCharacterLock).mockImplementation(async (_characterId: number, fn: () => Promise<unknown>) => fn());
  });

  it("returns 403 when csrf validation fails", async () => {
    vi.mocked(validateCsrfHeader).mockResolvedValue(false);

    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid CSRF token" });
  });

  it("returns 200 when local fitting is deleted", async () => {
    vi.mocked(validateCsrfHeader).mockResolvedValue(true);
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    vi.mocked(deleteStoredFittingPermanently).mockResolvedValue(true);

    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ deleted: true });
    expect(deleteStoredFittingPermanently).toHaveBeenCalledWith(100, 10);
  });

  it("returns 404 when local fitting does not exist", async () => {
    vi.mocked(validateCsrfHeader).mockResolvedValue(true);
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    vi.mocked(deleteStoredFittingPermanently).mockResolvedValue(false);

    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Fitting not found" });
  });
});

describe("GET /api/fits/[fittingId]/eft", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns eft output for valid requests", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    vi.mocked(getFittingEft).mockResolvedValue("[Pilgrim, Surprise]\nDamage Control II\n");

    const response = await GET_EFT(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ eft: "[Pilgrim, Surprise]\nDamage Control II\n" });
    expect(getFittingEft).toHaveBeenCalledWith(100, 10);
  });

  it("returns 400 for invalid fitting id", async () => {
    const response = await GET_EFT(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "bad" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid fitting id" });
  });

  it("returns 404 when eft source fitting is missing", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    const missing = new Error("missing") as NodeJS.ErrnoException;
    missing.code = "ENOENT";
    vi.mocked(getFittingEft).mockRejectedValue(missing);

    const response = await GET_EFT(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Fitting not found" });
  });

  it("returns 500 for unexpected eft failures", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    vi.mocked(getFittingEft).mockRejectedValue(new Error("upstream failure"));

    const response = await GET_EFT(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: "Unable to load fitting EFT" });
  });
});

describe("GET /api/fits/[fittingId]/bundle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns detail, eft, and price for valid requests", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    vi.mocked(getFittingDetail).mockResolvedValue({
      fitting: {
        description: "",
        fitting_id: 10,
        items: [],
        name: "Fit A",
        ship_type_id: 123
      },
      canRemoveFromEve: true,
      canSyncToEve: false,
      shipTypeId: 123,
      shipTypeName: "Caracal",
      fittingName: "Fit A",
      itemTypeNames: {},
      itemNamesByFlag: {}
    });
    vi.mocked(getFittingEft).mockResolvedValue("[Caracal, Fit A]");
    vi.mocked(getFittingPriceEstimate).mockResolvedValue({
      totalIsk: 1000000,
      appraisalUrl: "https://janice.e-351.com/a/abc123",
      lastModified: "2026-02-20T12:34:56.000Z"
    });
    vi.mocked(getFittingLastModified).mockResolvedValue("2026-02-20T12:34:56.000Z");

    const response = await GET_BUNDLE(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      detail: { fitting: { fitting_id: 10 } },
      eft: "[Caracal, Fit A]",
      price: { totalIsk: 1000000 }
    });
  });

  it("returns 404 when source fitting is missing", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    const missing = new Error("missing") as NodeJS.ErrnoException;
    missing.code = "ENOENT";
    vi.mocked(getFittingDetail).mockRejectedValue(missing);

    const response = await GET_BUNDLE(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Fitting not found" });
  });

  it("returns 500 when bundle detail lookup fails unexpectedly", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    vi.mocked(getFittingDetail).mockRejectedValue(new Error("downstream"));

    const response = await GET_BUNDLE(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: "Unable to load fitting bundle" });
  });

  it("returns partial bundle when eft or price fails", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    vi.mocked(getFittingDetail).mockResolvedValue({
      fitting: {
        description: "",
        fitting_id: 10,
        items: [],
        name: "Fit A",
        ship_type_id: 123
      },
      canRemoveFromEve: true,
      canSyncToEve: false,
      shipTypeId: 123,
      shipTypeName: "Caracal",
      fittingName: "Fit A",
      itemTypeNames: {},
      itemNamesByFlag: {}
    });
    vi.mocked(getFittingEft).mockRejectedValue(new Error("eft down"));
    vi.mocked(getFittingPriceEstimate).mockRejectedValue(new Error("price down"));
    vi.mocked(getFittingLastModified).mockResolvedValue("2026-02-20T12:34:56.000Z");

    const response = await GET_BUNDLE(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      eft: "Unable to load EFT format.",
      price: null
    });
  });
});

describe("GET /api/fits/[fittingId]/price", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns price estimate for valid requests", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    vi.mocked(getFittingPriceEstimate).mockResolvedValue({
      totalIsk: 52670123,
      appraisalUrl: "https://janice.e-351.com/a/abc123",
      lastModified: "2026-02-20T12:34:56.000Z"
    });

    const response = await GET_PRICE(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      totalIsk: 52670123,
      appraisalUrl: "https://janice.e-351.com/a/abc123",
      lastModified: "2026-02-20T12:34:56.000Z"
    });
    expect(getFittingPriceEstimate).toHaveBeenCalledWith(100, 10);
  });

  it("returns 400 for invalid fitting id", async () => {
    const response = await GET_PRICE(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "bad" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid fitting id" });
  });

  it("returns 404 when price lookup source fitting is missing", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    const missing = new Error("missing") as NodeJS.ErrnoException;
    missing.code = "ENOENT";
    vi.mocked(getFittingPriceEstimate).mockRejectedValue(missing);

    const response = await GET_PRICE(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Unable to estimate fitting price" });
  });

  it("returns 500 when price lookup fails unexpectedly", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    vi.mocked(getFittingPriceEstimate).mockRejectedValue(new Error("downstream"));

    const response = await GET_PRICE(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: "Unable to estimate fitting price" });
  });
});
