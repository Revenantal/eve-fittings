import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/esi-context", () => ({
  requireAuthenticatedEsiContext: vi.fn()
}));

vi.mock("@/lib/fits/service", () => ({
  getFittingDetail: vi.fn(),
  deleteStoredFittingPermanently: vi.fn(),
  getFittingPyfa: vi.fn()
}));

vi.mock("@/lib/storage/lock", () => ({
  withCharacterLock: vi.fn(async (_characterId: number, fn: () => Promise<unknown>) => fn())
}));

vi.mock("@/server/auth/csrf", () => ({
  validateCsrfHeader: vi.fn()
}));

import { deleteStoredFittingPermanently, getFittingDetail, getFittingPyfa } from "@/lib/fits/service";
import { withCharacterLock } from "@/lib/storage/lock";
import { validateCsrfHeader } from "@/server/auth/csrf";
import { requireAuthenticatedEsiContext } from "@/server/auth/esi-context";
import { DELETE, GET } from "@/app/api/fits/[fittingId]/route";
import { GET as GET_PYFA } from "@/app/api/fits/[fittingId]/pyfa/route";

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
      fittingName: "Fit A"
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
      fittingName: "Fit A"
    });
    expect(getFittingDetail).toHaveBeenCalledWith(100, 10);
  });

  it("returns 404 when detail lookup fails", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    vi.mocked(getFittingDetail).mockRejectedValue(new Error("missing"));

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Fitting not found" });
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

describe("GET /api/fits/[fittingId]/pyfa", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns pyfa output for valid requests", async () => {
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 100,
      accessToken: "token"
    });
    vi.mocked(getFittingPyfa).mockResolvedValue("[Pilgrim, Surprise]\nDamage Control II\n");

    const response = await GET_PYFA(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ pyfa: "[Pilgrim, Surprise]\nDamage Control II\n" });
    expect(getFittingPyfa).toHaveBeenCalledWith(100, 10);
  });

  it("returns 400 for invalid fitting id", async () => {
    const response = await GET_PYFA(new Request("http://localhost"), {
      params: Promise.resolve({ fittingId: "bad" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid fitting id" });
  });
});
