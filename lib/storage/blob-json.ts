import "server-only";

import { del, get, put } from "@vercel/blob";

import { env } from "@/server/config/env";

type BlobJsonCacheEntry = {
  expiresAt: number;
  value: unknown;
};

const readCache = new Map<string, BlobJsonCacheEntry>();
const inFlightReads = new Map<string, Promise<unknown | null>>();

function tokenOption(): { token?: string } {
  return env.blobReadWriteToken ? { token: env.blobReadWriteToken } : {};
}

function cacheTtlMs(): number {
  return env.blobJsonCacheTtlSeconds * 1000;
}

function cacheEnabled(): boolean {
  return env.blobJsonCacheTtlSeconds > 0 && env.blobJsonCacheMaxEntries > 0;
}

function invalidatePath(pathname: string): void {
  readCache.delete(pathname);
  inFlightReads.delete(pathname);
}

function evictExpired(now: number): void {
  for (const [key, entry] of readCache.entries()) {
    if (entry.expiresAt <= now) {
      readCache.delete(key);
    }
  }
}

function setCachedValue(pathname: string, value: unknown): void {
  if (!cacheEnabled()) {
    return;
  }
  const now = Date.now();
  evictExpired(now);
  while (readCache.size >= env.blobJsonCacheMaxEntries) {
    const oldestKey = readCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    readCache.delete(oldestKey);
  }
  readCache.set(pathname, {
    value,
    expiresAt: now + cacheTtlMs()
  });
}

function getCachedValue<T>(pathname: string): T | undefined {
  if (!cacheEnabled()) {
    return undefined;
  }
  const cached = readCache.get(pathname);
  if (!cached) {
    return undefined;
  }
  if (cached.expiresAt <= Date.now()) {
    readCache.delete(pathname);
    return undefined;
  }
  return cached.value as T;
}

export async function writePrivateBlobJson(pathname: string, payload: unknown): Promise<void> {
  invalidatePath(pathname);
  await put(pathname, JSON.stringify(payload, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    ...tokenOption()
  });
}

export async function readPrivateBlobJson<T>(pathname: string): Promise<T | null> {
  const cached = getCachedValue<T>(pathname);
  if (cached !== undefined) {
    return cached;
  }

  const inFlight = inFlightReads.get(pathname);
  if (inFlight) {
    return (await inFlight) as T | null;
  }

  const readPromise = (async () => {
    const result = await get(pathname, {
      access: "private",
      ...tokenOption()
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as T;
    setCachedValue(pathname, parsed);
    return parsed;
  })();

  inFlightReads.set(pathname, readPromise);
  try {
    return await readPromise;
  } finally {
    inFlightReads.delete(pathname);
  }
}

export async function deletePrivateBlob(pathname: string): Promise<void> {
  invalidatePath(pathname);
  await del(pathname, tokenOption());
}
