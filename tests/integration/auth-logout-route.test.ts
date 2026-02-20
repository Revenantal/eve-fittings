import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/csrf", () => ({
  validateCsrfHeader: vi.fn()
}));

vi.mock("@/server/auth/session-service", () => ({
  logoutCurrentSession: vi.fn()
}));

vi.mock("@/server/logging/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

import { validateCsrfHeader } from "@/server/auth/csrf";
import { logoutCurrentSession } from "@/server/auth/session-service";
import { POST } from "@/app/api/auth/logout/route";

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 403 when csrf check fails", async () => {
    vi.mocked(validateCsrfHeader).mockResolvedValue(false);

    const response = await POST(new Request("http://localhost/api/auth/logout", { method: "POST" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid CSRF token" });
  });

  it("logs out and returns ok", async () => {
    vi.mocked(validateCsrfHeader).mockResolvedValue(true);
    vi.mocked(logoutCurrentSession).mockResolvedValue(undefined);

    const response = await POST(new Request("http://localhost/api/auth/logout", { method: "POST" }));

    expect(logoutCurrentSession).toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });
});
