import "server-only";

import path from "node:path";

type Env = {
  appUrl: string;
  eveClientId: string;
  eveClientSecret: string;
  eveCallbackUrl: string;
  tokenEncryptionKey: string;
  fitsStorageRoot: string;
  logLevel: string;
  shipTypeCacheTtlDays: number;
  userAgent: string;
  sessionTtlHours: number;
  syncMinIntervalSeconds: number;
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

const tokenKey = required("TOKEN_ENCRYPTION_KEY");
if (tokenKey.length < 32) {
  throw new Error("TOKEN_ENCRYPTION_KEY must be at least 32 characters.");
}

const storageRoot = required("FITS_STORAGE_ROOT");
if (storageRoot.includes("public")) {
  throw new Error("FITS_STORAGE_ROOT cannot point to a public directory.");
}

export const env: Env = {
  appUrl: required("NEXT_PUBLIC_APP_URL"),
  eveClientId: required("EVE_CLIENT_ID"),
  eveClientSecret: required("EVE_CLIENT_SECRET"),
  eveCallbackUrl: required("EVE_CALLBACK_URL"),
  tokenEncryptionKey: tokenKey,
  fitsStorageRoot: path.resolve(storageRoot),
  logLevel: optional("LOG_LEVEL", "info"),
  shipTypeCacheTtlDays: optionalNumber("SHIP_TYPE_CACHE_TTL_DAYS", 30),
  userAgent: optional("ESI_USER_AGENT", "eve-fittings/0.1 (+https://localhost)"),
  sessionTtlHours: optionalNumber("SESSION_TTL_HOURS", 168),
  syncMinIntervalSeconds: optionalNumber("SYNC_MIN_INTERVAL_SECONDS", 300)
};
