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
  syncCharacterFittings: vi.fn()
}));

vi.mock("@/server/esi/sync-throttle", () => ({
  consumeSyncSlot: vi.fn()
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
import { withCharacterLock } from "@/lib/storage/lock";
import { validateCsrfHeader } from "@/server/auth/csrf";
import { requireAuthenticatedEsiContext } from "@/server/auth/esi-context";
import { consumeSyncSlot } from "@/server/esi/sync-throttle";
import { POST } from "@/app/api/fits/sync/route";

describe("POST /api/fits/sync", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(withCharacterLock).mockImplementation(async (_characterId: number, fn: () => Promise<unknown>) => fn());
    vi.mocked(consumeSyncSlot).mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
  });

  it("returns 403 when CSRF token is invalid", async () => {
    vi.mocked(validateCsrfHeader).mockResolvedValue(false);

    const response = await POST(new Request("http://localhost/api/fits/sync", { method: "POST" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid CSRF token" });
  });

  it("returns sync summary when authenticated", async () => {
    vi.mocked(validateCsrfHeader).mockResolvedValue(true);
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 9001,
      accessToken: "token"
    });
    vi.mocked(syncCharacterFittings).mockResolvedValue({ count: 6, syncedAt: "2026-02-20T00:00:00.000Z" });

    const response = await POST(new Request("http://localhost/api/fits/sync", { method: "POST" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ count: 6, syncedAt: "2026-02-20T00:00:00.000Z" });
    expect(syncCharacterFittings).toHaveBeenCalledWith(9001, "token");
  });

  it("returns 401 when auth context fails", async () => {
    vi.mocked(validateCsrfHeader).mockResolvedValue(true);
    vi.mocked(requireAuthenticatedEsiContext).mockRejectedValue(new Error("Not authenticated"));

    const response = await POST(new Request("http://localhost/api/fits/sync", { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });

  it("returns 429 when throttled", async () => {
    vi.mocked(validateCsrfHeader).mockResolvedValue(true);
    vi.mocked(requireAuthenticatedEsiContext).mockResolvedValue({
      sessionId: "s1",
      characterId: 9001,
      accessToken: "token"
    });
    vi.mocked(consumeSyncSlot).mockReturnValue({ allowed: false, retryAfterSeconds: 42 });

    const response = await POST(new Request("http://localhost/api/fits/sync", { method: "POST" }));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: "Sync recently requested. Please retry shortly.",
      details: { retryAfterSeconds: 42 }
    });
  });
});
