import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/csrf", () => ({
  validateCsrfHeader: vi.fn()
}));

vi.mock("@/server/auth/esi-context", () => ({
  requireAuthenticatedEsiContext: vi.fn()
}));

vi.mock("@/lib/storage/lock", () => ({
  withCharacterLock: vi.fn(async (_characterId: number, fn: () => Promise<unknown>) => fn())
}));

vi.mock("@/lib/fits/service", () => ({
  removeFittingFromEve: vi.fn(),
  syncCharacterFittings: vi.fn()
}));

import { removeFittingFromEve, syncCharacterFittings } from "@/lib/fits/service";
import { withCharacterLock } from "@/lib/storage/lock";
import { validateCsrfHeader } from "@/server/auth/csrf";
import { requireAuthenticatedEsiContext } from "@/server/auth/esi-context";
import { POST } from "@/app/api/fits/[fittingId]/remove/route";

describe("POST /api/fits/[fittingId]/remove", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(withCharacterLock).mockImplementation(async (_characterId: number, fn: () => Promise<unknown>) => fn());
  });

  it("returns 400 when confirmation is missing", async () => {
    vi.mocked(validateCsrfHeader).mockResolvedValue(true);

    const response = await POST(new Request("http://localhost", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Missing confirmation" });
  });

  it("returns success with stale false when refresh succeeds", async () => {
    vi.mocked(validateCsrfHeader).mockResolvedValue(true);
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 55,
      accessToken: "token"
    });
    vi.mocked(removeFittingFromEve).mockResolvedValue(undefined);
    vi.mocked(syncCharacterFittings).mockResolvedValue({ count: 1, syncedAt: "2026-02-20T00:00:00.000Z" });

    const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ confirm: true }) }), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      removed: true,
      stale: false,
      refresh: { count: 1, syncedAt: "2026-02-20T00:00:00.000Z" }
    });
    expect(removeFittingFromEve).toHaveBeenCalledWith(55, 10, "token");
  });

  it("returns stale true when post-remove refresh fails", async () => {
    vi.mocked(validateCsrfHeader).mockResolvedValue(true);
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 55,
      accessToken: "token"
    });
    vi.mocked(removeFittingFromEve).mockResolvedValue(undefined);
    vi.mocked(syncCharacterFittings).mockRejectedValue(new Error("429"));

    const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ confirm: true }) }), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ removed: true, stale: true });
  });
});