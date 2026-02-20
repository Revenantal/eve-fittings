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
  syncStoredFittingToEve: vi.fn(),
  syncCharacterFittings: vi.fn()
}));

import { syncCharacterFittings, syncStoredFittingToEve } from "@/lib/fits/service";
import { withCharacterLock } from "@/lib/storage/lock";
import { validateCsrfHeader } from "@/server/auth/csrf";
import { requireAuthenticatedEsiContext } from "@/server/auth/esi-context";
import { POST } from "@/app/api/fits/[fittingId]/sync/route";

describe("POST /api/fits/[fittingId]/sync", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(withCharacterLock).mockImplementation(async (_characterId: number, fn: () => Promise<unknown>) => fn());
  });

  it("returns 403 when csrf validation fails", async () => {
    vi.mocked(validateCsrfHeader).mockResolvedValue(false);

    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid CSRF token" });
  });

  it("returns success with stale false when sync and refresh succeed", async () => {
    vi.mocked(validateCsrfHeader).mockResolvedValue(true);
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 77,
      accessToken: "token"
    });
    vi.mocked(syncStoredFittingToEve).mockResolvedValue(999);
    vi.mocked(syncCharacterFittings).mockResolvedValue({ count: 3, syncedAt: "2026-02-20T00:00:00.000Z" });

    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      synced: true,
      newFittingId: 999,
      stale: false,
      refresh: { count: 3, syncedAt: "2026-02-20T00:00:00.000Z" }
    });
  });

  it("returns stale true when refresh fails after sync", async () => {
    vi.mocked(validateCsrfHeader).mockResolvedValue(true);
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 77,
      accessToken: "token"
    });
    vi.mocked(syncStoredFittingToEve).mockResolvedValue(999);
    vi.mocked(syncCharacterFittings).mockRejectedValue(new Error("429"));

    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ fittingId: "10" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ synced: true, newFittingId: 999, stale: true });
  });
});