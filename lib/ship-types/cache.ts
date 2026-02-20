import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { env } from "@/server/config/env";

type ShipTypeCacheRecord = {
  shipTypeId: number;
  shipTypeName: string;
  cachedAt: string;
  expiresAt: string;
};

type TypeNameCacheRecord = {
  typeId: number;
  typeName: string;
  cachedAt: string;
  expiresAt: string;
};

function refDataCacheTtlDays(): number {
  return Math.max(30, env.shipTypeCacheTtlDays);
}

function cacheFilePath(shipTypeId: number): string {
  return path.join(env.fitsStorageRoot, "_cache", "ship-types", `${shipTypeId}.json`);
}

function typeCacheFilePath(typeId: number): string {
  return path.join(env.fitsStorageRoot, "_cache", "types", `${typeId}.json`);
}

async function readCacheRecord(shipTypeId: number): Promise<ShipTypeCacheRecord | null> {
  try {
    const raw = await fs.readFile(cacheFilePath(shipTypeId), "utf8");
    return JSON.parse(raw) as ShipTypeCacheRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeCacheRecord(record: ShipTypeCacheRecord): Promise<void> {
  const filePath = cacheFilePath(record.shipTypeId);
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = path.join(dir, `${record.shipTypeId}.${Date.now()}.tmp`);
  await fs.writeFile(tempPath, JSON.stringify(record, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

async function fetchShipTypeName(shipTypeId: number): Promise<string> {
  const response = await fetch(`https://ref-data.everef.net/types/${shipTypeId}`);
  if (!response.ok) {
    return String(shipTypeId);
  }
  const body = (await response.json()) as { name?: { en?: string }; type_id?: number };
  return body.name?.en || String(body.type_id ?? shipTypeId);
}

async function readTypeCacheRecord(typeId: number): Promise<TypeNameCacheRecord | null> {
  try {
    const raw = await fs.readFile(typeCacheFilePath(typeId), "utf8");
    return JSON.parse(raw) as TypeNameCacheRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeTypeCacheRecord(record: TypeNameCacheRecord): Promise<void> {
  const filePath = typeCacheFilePath(record.typeId);
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = path.join(dir, `${record.typeId}.${Date.now()}.tmp`);
  await fs.writeFile(tempPath, JSON.stringify(record, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

export async function resolveShipTypeName(shipTypeId: number): Promise<string> {
  const existing = await readCacheRecord(shipTypeId);
  const now = new Date();

  if (existing && new Date(existing.expiresAt) > now) {
    return existing.shipTypeName;
  }

  const shipTypeName = await fetchShipTypeName(shipTypeId);
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + refDataCacheTtlDays());

  await writeCacheRecord({
    shipTypeId,
    shipTypeName,
    cachedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  });

  return shipTypeName;
}

export async function resolveTypeName(typeId: number): Promise<string> {
  const existing = await readTypeCacheRecord(typeId);
  const now = new Date();

  if (existing && new Date(existing.expiresAt) > now) {
    return existing.typeName;
  }

  const response = await fetch(`https://ref-data.everef.net/types/${typeId}`);
  let typeName = String(typeId);
  if (response.ok) {
    const body = (await response.json()) as { name?: { en?: string }; type_id?: number };
    typeName = body.name?.en || String(body.type_id ?? typeId);
  }

  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + refDataCacheTtlDays());
  await writeTypeCacheRecord({
    typeId,
    typeName,
    cachedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  });

  return typeName;
}
