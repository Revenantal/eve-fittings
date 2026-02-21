import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();
const putMock = vi.fn();
const delMock = vi.fn();

vi.mock("@vercel/blob", () => ({
  get: getMock,
  put: putMock,
  del: delMock
}));

vi.mock("@/server/config/env", () => ({
  env: {
    blobReadWriteToken: undefined,
    blobJsonCacheTtlSeconds: 300,
    blobJsonCacheMaxEntries: 1000
  }
}));

function streamFromJson(payload: unknown): ReadableStream<Uint8Array> {
  return new Response(JSON.stringify(payload)).body as ReadableStream<Uint8Array>;
}

describe("blob json cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("caches blob reads within ttl", async () => {
    getMock.mockResolvedValue({
      statusCode: 200,
      stream: streamFromJson({ fittingId: 123, name: "Fit A" })
    });

    const { readPrivateBlobJson } = await import("@/lib/storage/blob-json");

    const first = await readPrivateBlobJson<{ fittingId: number; name: string }>("fits/1/123.json");
    const second = await readPrivateBlobJson<{ fittingId: number; name: string }>("fits/1/123.json");

    expect(first).toEqual({ fittingId: 123, name: "Fit A" });
    expect(second).toEqual({ fittingId: 123, name: "Fit A" });
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("invalidates cached reads on write", async () => {
    getMock.mockImplementation(async () => ({
      statusCode: 200,
      stream: streamFromJson({ fittingId: 123, name: "Fit A" })
    }));

    const { readPrivateBlobJson, writePrivateBlobJson } = await import("@/lib/storage/blob-json");
    const path = "fits/1/123.json";

    await readPrivateBlobJson(path);
    await writePrivateBlobJson(path, { fittingId: 123, name: "Fit B" });
    await readPrivateBlobJson(path);

    expect(putMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent reads for the same pathname", async () => {
    let resolveGet!: (value: { statusCode: number; stream: ReadableStream<Uint8Array> }) => void;
    getMock.mockReturnValue(
      new Promise((resolve) => {
        resolveGet = resolve;
      })
    );

    const { readPrivateBlobJson } = await import("@/lib/storage/blob-json");
    const path = "fits/1/123.json";

    const readA = readPrivateBlobJson(path);
    const readB = readPrivateBlobJson(path);

    resolveGet({
      statusCode: 200,
      stream: streamFromJson({ fittingId: 123, name: "Fit A" })
    });

    const [a, b] = await Promise.all([readA, readB]);

    expect(a).toEqual({ fittingId: 123, name: "Fit A" });
    expect(b).toEqual({ fittingId: 123, name: "Fit A" });
    expect(getMock).toHaveBeenCalledTimes(1);
  });
});
