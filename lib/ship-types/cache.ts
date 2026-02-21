import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { env } from "@/server/config/env";

type ShipTypeCacheRecord = {
  shipTypeId: number;
  shipTypeName: string;
  groupId?: number | null;
  factionId?: number | null;
  raceId?: number | null;
  cachedAt: string;
  expiresAt: string;
};

type TypeNameCacheRecord = {
  typeId: number;
  typeName: string;
  cachedAt: string;
  expiresAt: string;
};

type GroupNameCacheRecord = {
  groupId: number;
  groupName: string;
  cachedAt: string;
  expiresAt: string;
};

type FactionMapCacheRecord = {
  factions: Record<string, string>;
  cachedAt: string;
  expiresAt: string;
};

type RaceMapCacheRecord = {
  races: Record<string, string>;
  cachedAt: string;
  expiresAt: string;
};

type ShipTypeDescriptor = {
  shipTypeName: string;
  groupId: number | null;
  factionId: number | null;
  raceId: number | null;
};

export type ShipGroupingMetadata = {
  shipTypeId: number;
  shipTypeName: string;
  shipClassName: string;
  shipFactionName: string;
};

function refDataCacheTtlDays(): number {
  return Math.max(30, env.shipTypeCacheTtlDays);
}

function cacheFilePath(shipTypeId: number): string {
  return path.join(env.cacheStorageRoot, "ship-types", `${shipTypeId}.json`);
}

function typeCacheFilePath(typeId: number): string {
  return path.join(env.cacheStorageRoot, "types", `${typeId}.json`);
}

function groupCacheFilePath(groupId: number): string {
  return path.join(env.cacheStorageRoot, "groups", `${groupId}.json`);
}

function factionMapCacheFilePath(): string {
  return path.join(env.cacheStorageRoot, "factions", "universe-factions.json");
}

function raceMapCacheFilePath(): string {
  return path.join(env.cacheStorageRoot, "races", "universe-races.json");
}

function isFresh(expiresAt: string, now: Date): boolean {
  return new Date(expiresAt) > now;
}

function hasShipGroupingMetadata(record: ShipTypeCacheRecord): boolean {
  return (
    Number.isFinite(record.groupId) ||
    Number.isFinite(record.factionId) ||
    Number.isFinite(record.raceId)
  );
}

function withTtl(now: Date): string {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + refDataCacheTtlDays());
  return expiresAt.toISOString();
}

async function writeJsonAtomic(filePath: string, fileNamePrefix: string, payload: unknown): Promise<void> {
  try {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const tempPath = path.join(dir, `${fileNamePrefix}.${Date.now()}.${randomUUID()}.tmp`);
    const serialized = JSON.stringify(payload, null, 2);
    await fs.writeFile(tempPath, serialized, "utf8");
    try {
      await fs.rename(tempPath, filePath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") {
        throw error;
      }
      // OneDrive/AV can briefly lock files; fallback keeps cache warm.
      await fs.writeFile(filePath, serialized, "utf8");
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore temp cleanup failures.
      }
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "ENOENT" || code === "EACCES" || code === "EPERM") {
      // Cache writes are best-effort; read-only/serverless filesystems should not fail API requests.
      return;
    }
    throw error;
  }
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
  await writeJsonAtomic(cacheFilePath(record.shipTypeId), String(record.shipTypeId), record);
}

async function fetchShipTypeDescriptor(shipTypeId: number): Promise<ShipTypeDescriptor> {
  const response = await fetch(`https://ref-data.everef.net/types/${shipTypeId}`, {
    headers: {
      "User-Agent": env.userAgent
    }
  });
  if (!response.ok) {
    const fallback = String(shipTypeId);
    return {
      shipTypeName: fallback,
      groupId: null,
      factionId: null,
      raceId: null
    };
  }
  const body = (await response.json()) as {
    name?: { en?: string };
    type_id?: number;
    group_id?: number;
    faction_id?: number;
    race_id?: number;
  };
  return {
    shipTypeName: body.name?.en || String(body.type_id ?? shipTypeId),
    groupId: Number.isFinite(body.group_id) ? Number(body.group_id) : null,
    factionId: Number.isFinite(body.faction_id) ? Number(body.faction_id) : null,
    raceId: Number.isFinite(body.race_id) ? Number(body.race_id) : null
  };
}

async function fetchTypeName(typeId: number): Promise<string> {
  const everefResponse = await fetch(`https://ref-data.everef.net/types/${typeId}`, {
    headers: {
      "User-Agent": env.userAgent
    }
  });
  if (everefResponse.ok) {
    const body = (await everefResponse.json()) as { name?: { en?: string }; type_id?: number };
    const name = body.name?.en;
    if (name && name.trim().length > 0) {
      return name;
    }
  }

  const esiResponse = await fetch(`https://esi.evetech.net/latest/universe/types/${typeId}/`, {
    headers: {
      Accept: "application/json",
      "User-Agent": env.userAgent
    }
  });
  if (esiResponse.ok) {
    const body = (await esiResponse.json()) as { name?: string; type_id?: number };
    const name = body.name;
    if (name && name.trim().length > 0) {
      return name;
    }
  }

  return String(typeId);
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
  await writeJsonAtomic(typeCacheFilePath(record.typeId), String(record.typeId), record);
}

async function readGroupCacheRecord(groupId: number): Promise<GroupNameCacheRecord | null> {
  try {
    const raw = await fs.readFile(groupCacheFilePath(groupId), "utf8");
    return JSON.parse(raw) as GroupNameCacheRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeGroupCacheRecord(record: GroupNameCacheRecord): Promise<void> {
  await writeJsonAtomic(groupCacheFilePath(record.groupId), String(record.groupId), record);
}

async function fetchGroupName(groupId: number): Promise<string> {
  const response = await fetch(`https://ref-data.everef.net/groups/${groupId}`, {
    headers: {
      "User-Agent": env.userAgent
    }
  });
  if (!response.ok) {
    return "Unknown Class";
  }
  const body = (await response.json()) as { name?: { en?: string } };
  return body.name?.en?.trim() || "Unknown Class";
}

async function readFactionMapCacheRecord(): Promise<FactionMapCacheRecord | null> {
  try {
    const raw = await fs.readFile(factionMapCacheFilePath(), "utf8");
    return JSON.parse(raw) as FactionMapCacheRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeFactionMapCacheRecord(record: FactionMapCacheRecord): Promise<void> {
  await writeJsonAtomic(factionMapCacheFilePath(), "factions", record);
}

async function fetchFactionMap(): Promise<Record<string, string>> {
  const response = await fetch("https://esi.evetech.net/latest/universe/factions/", {
    headers: {
      Accept: "application/json",
      "User-Agent": env.userAgent
    }
  });
  if (!response.ok) {
    return {};
  }
  const body = (await response.json()) as Array<{ faction_id?: number; name?: string }>;
  const factionEntries = body
    .filter((entry) => Number.isFinite(entry.faction_id) && typeof entry.name === "string" && entry.name.trim().length > 0)
    .map((entry) => [String(entry.faction_id), entry.name!.trim()]);
  return Object.fromEntries(factionEntries);
}

async function readRaceMapCacheRecord(): Promise<RaceMapCacheRecord | null> {
  try {
    const raw = await fs.readFile(raceMapCacheFilePath(), "utf8");
    return JSON.parse(raw) as RaceMapCacheRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeRaceMapCacheRecord(record: RaceMapCacheRecord): Promise<void> {
  await writeJsonAtomic(raceMapCacheFilePath(), "races", record);
}

async function fetchRaceMap(): Promise<Record<string, string>> {
  const response = await fetch("https://esi.evetech.net/latest/universe/races/", {
    headers: {
      Accept: "application/json",
      "User-Agent": env.userAgent
    }
  });
  if (!response.ok) {
    return {};
  }
  const body = (await response.json()) as Array<{ race_id?: number; name?: string }>;
  const raceEntries = body
    .filter((entry) => Number.isFinite(entry.race_id) && typeof entry.name === "string" && entry.name.trim().length > 0)
    .map((entry) => [String(entry.race_id), entry.name!.trim()]);
  return Object.fromEntries(raceEntries);
}

async function resolveShipTypeDescriptor(shipTypeId: number): Promise<ShipTypeDescriptor> {
  const existing = await readCacheRecord(shipTypeId);
  const now = new Date();

  if (existing && isFresh(existing.expiresAt, now) && hasShipGroupingMetadata(existing)) {
    return {
      shipTypeName: existing.shipTypeName,
      groupId: Number.isFinite(existing.groupId) ? Number(existing.groupId) : null,
      factionId: Number.isFinite(existing.factionId) ? Number(existing.factionId) : null,
      raceId: Number.isFinite(existing.raceId) ? Number(existing.raceId) : null
    };
  }

  const descriptor = await fetchShipTypeDescriptor(shipTypeId);
  const fetchedHasMetadata = descriptor.groupId !== null || descriptor.factionId !== null || descriptor.raceId !== null;

  if (!fetchedHasMetadata && existing) {
    return {
      shipTypeName: existing.shipTypeName,
      groupId: Number.isFinite(existing.groupId) ? Number(existing.groupId) : null,
      factionId: Number.isFinite(existing.factionId) ? Number(existing.factionId) : null,
      raceId: Number.isFinite(existing.raceId) ? Number(existing.raceId) : null
    };
  }

  await writeCacheRecord({
    shipTypeId,
    shipTypeName: descriptor.shipTypeName,
    groupId: descriptor.groupId,
    factionId: descriptor.factionId,
    raceId: descriptor.raceId,
    cachedAt: now.toISOString(),
    expiresAt: withTtl(now)
  });

  return descriptor;
}

async function resolveShipClassName(groupId: number | null): Promise<string> {
  if (groupId === null) {
    return "Unknown Class";
  }

  const existing = await readGroupCacheRecord(groupId);
  const now = new Date();
  if (existing && isFresh(existing.expiresAt, now)) {
    return existing.groupName;
  }

  const groupName = await fetchGroupName(groupId);
  if (groupName !== "Unknown Class") {
    await writeGroupCacheRecord({
      groupId,
      groupName,
      cachedAt: now.toISOString(),
      expiresAt: withTtl(now)
    });
  } else if (existing) {
    return existing.groupName;
  }
  return groupName;
}

async function resolveCachedFactionMap(): Promise<Record<string, string>> {
  const existing = await readFactionMapCacheRecord();
  const now = new Date();
  if (existing && isFresh(existing.expiresAt, now)) {
    return existing.factions;
  }

  const factions = await fetchFactionMap();
  if (Object.keys(factions).length > 0) {
    await writeFactionMapCacheRecord({
      factions,
      cachedAt: now.toISOString(),
      expiresAt: withTtl(now)
    });
    return factions;
  }
  return existing?.factions ?? {};
}

async function resolveCachedRaceMap(): Promise<Record<string, string>> {
  const existing = await readRaceMapCacheRecord();
  const now = new Date();
  if (existing && isFresh(existing.expiresAt, now)) {
    return existing.races;
  }

  const races = await fetchRaceMap();
  if (Object.keys(races).length > 0) {
    await writeRaceMapCacheRecord({
      races,
      cachedAt: now.toISOString(),
      expiresAt: withTtl(now)
    });
    return races;
  }
  return existing?.races ?? {};
}

async function resolveShipFactionName(factionId: number | null, raceId: number | null): Promise<string> {
  if (factionId !== null) {
    const factionMap = await resolveCachedFactionMap();
    const factionName = factionMap[String(factionId)];
    if (factionName && factionName.trim().length > 0) {
      return factionName;
    }
  }

  if (raceId !== null) {
    const raceMap = await resolveCachedRaceMap();
    const raceName = raceMap[String(raceId)];
    if (raceName && raceName.trim().length > 0) {
      return raceName;
    }
  }

  return "Unknown Faction";
}

export async function resolveShipTypeName(shipTypeId: number): Promise<string> {
  const descriptor = await resolveShipTypeDescriptor(shipTypeId);
  return descriptor.shipTypeName;
}

export async function resolveShipGroupingMetadata(shipTypeId: number): Promise<ShipGroupingMetadata> {
  const descriptor = await resolveShipTypeDescriptor(shipTypeId);
  const [shipClassName, shipFactionName] = await Promise.all([
    resolveShipClassName(descriptor.groupId),
    resolveShipFactionName(descriptor.factionId, descriptor.raceId)
  ]);
  return {
    shipTypeId,
    shipTypeName: descriptor.shipTypeName,
    shipClassName,
    shipFactionName
  };
}

export async function resolveTypeName(typeId: number): Promise<string> {
  const existing = await readTypeCacheRecord(typeId);
  const now = new Date();
  const numericFallback = String(typeId);

  if (existing && existing.typeName !== numericFallback && isFresh(existing.expiresAt, now)) {
    return existing.typeName;
  }

  const typeName = await fetchTypeName(typeId);

  if (typeName !== numericFallback) {
    await writeTypeCacheRecord({
      typeId,
      typeName,
      cachedAt: now.toISOString(),
      expiresAt: withTtl(now)
    });
  }

  return typeName;
}
