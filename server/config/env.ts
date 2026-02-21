import "server-only";

import path from "node:path";
import { logger } from "@/server/logging/logger";

type StorageBackend = "local" | "blob";

type Env = {
  appUrl: string;
  eveClientId: string;
  eveClientSecret: string;
  eveCallbackUrl: string;
  tokenEncryptionKey: string;
  fitsStorageBackend: StorageBackend;
  fitsStorageRoot: string;
  cacheStorageRoot: string;
  sessionStorageBackend: StorageBackend;
  blobReadWriteToken?: string;
  fitsBlobPrefix: string;
  sessionBlobPrefix: string;
  blobJsonCacheTtlSeconds: number;
  blobJsonCacheMaxEntries: number;
  logLevel: string;
  shipTypeCacheTtlDays: number;
  userAgent: string;
  sessionTtlHours: number;
  syncMinIntervalSeconds: number;
  janiceApiKey: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function optionalNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value || !value.trim()) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }
  return parsed;
}

function optionalEnum<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const value = process.env[name];
  if (!value || !value.trim()) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (allowed.includes(normalized as T)) {
    return normalized as T;
  }
  throw new Error(`Invalid value for ${name}. Allowed values: ${allowed.join(", ")}`);
}

function validatePathSegment(name: string, value: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`${name} must contain only letters, numbers, underscores, or hyphens.`);
  }
  return value;
}

const tokenKey = required("TOKEN_ENCRYPTION_KEY");
if (tokenKey.length < 32) {
  throw new Error("TOKEN_ENCRYPTION_KEY must be at least 32 characters.");
}

const fitsStorageBackend = optionalEnum("FITS_STORAGE_BACKEND", ["local", "blob"] as const, "local");
const sessionStorageBackend = optionalEnum("SESSION_STORAGE_BACKEND", ["local", "blob"] as const, fitsStorageBackend);
const storageRoot = optional("FITS_STORAGE_ROOT", "./data");
const cacheRoot = optional("CACHE_STORAGE_ROOT", "./.cache/eve-fittings");
const blobReadWriteToken = optional("BLOB_READ_WRITE_TOKEN", "");
const fitsBlobPrefix = validatePathSegment("FITS_BLOB_PREFIX", optional("FITS_BLOB_PREFIX", "fits"));
const sessionBlobPrefix = validatePathSegment("SESSION_BLOB_PREFIX", optional("SESSION_BLOB_PREFIX", "sessions"));

if (fitsStorageBackend === "local" && storageRoot.includes("public")) {
  throw new Error("FITS_STORAGE_ROOT cannot point to a public directory.");
}
if (cacheRoot.includes("public")) {
  throw new Error("CACHE_STORAGE_ROOT cannot point to a public directory.");
}
if ((fitsStorageBackend === "blob" || sessionStorageBackend === "blob") && !blobReadWriteToken) {
  throw new Error("BLOB_READ_WRITE_TOKEN is required when FITS_STORAGE_BACKEND or SESSION_STORAGE_BACKEND is 'blob'.");
}

export const env: Env = {
  appUrl: required("NEXT_PUBLIC_APP_URL"),
  eveClientId: required("EVE_CLIENT_ID"),
  eveClientSecret: required("EVE_CLIENT_SECRET"),
  eveCallbackUrl: required("EVE_CALLBACK_URL"),
  tokenEncryptionKey: tokenKey,
  fitsStorageBackend,
  fitsStorageRoot: path.resolve(storageRoot),
  cacheStorageRoot: path.resolve(cacheRoot),
  sessionStorageBackend,
  blobReadWriteToken: blobReadWriteToken || undefined,
  fitsBlobPrefix,
  sessionBlobPrefix,
  blobJsonCacheTtlSeconds: optionalNumber("BLOB_JSON_CACHE_TTL_SECONDS", 300),
  blobJsonCacheMaxEntries: optionalNumber("BLOB_JSON_CACHE_MAX_ENTRIES", 1000),
  logLevel: optional("LOG_LEVEL", "info"),
  shipTypeCacheTtlDays: optionalNumber("SHIP_TYPE_CACHE_TTL_DAYS", 30),
  userAgent: optional("ESI_USER_AGENT", "eve-fittings/0.1 (+https://localhost)"),
  sessionTtlHours: optionalNumber("SESSION_TTL_HOURS", 168),
  syncMinIntervalSeconds: optionalNumber("SYNC_MIN_INTERVAL_SECONDS", 300),
  janiceApiKey: required("JANICE_API_KEY")
};

logger.info("storage_config_loaded", {
  fitsStorageBackend: env.fitsStorageBackend,
  sessionStorageBackend: env.sessionStorageBackend,
  fitsStorageRoot: env.fitsStorageRoot,
  cacheStorageRoot: env.cacheStorageRoot,
  fitsBlobPrefix: env.fitsBlobPrefix,
  sessionBlobPrefix: env.sessionBlobPrefix,
  blobJsonCacheTtlSeconds: env.blobJsonCacheTtlSeconds,
  blobJsonCacheMaxEntries: env.blobJsonCacheMaxEntries,
  blobTokenConfigured: Boolean(env.blobReadWriteToken)
});
