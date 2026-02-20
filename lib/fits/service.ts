import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createFitting, deleteFitting, getFittings } from "@/server/esi/client";
import type { EsiFitting } from "@/server/esi/types";
import { deleteStoredFitting, listStoredFittings, readFitting, tryReadIndex, writeFittings } from "@/lib/storage/fits-store";
import { resolveShipTypeName, resolveTypeName } from "@/lib/ship-types/cache";
import { env } from "@/server/config/env";

export type GroupedFit = {
  shipTypeId: number;
  shipTypeName: string;
  fittings: Array<{
    fittingId: number;
    name: string;
    isSyncedToEve: boolean;
  }>;
};

function isNumericText(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

async function resolveTypeNameForUi(typeId: number): Promise<string> {
  const cachedOrResolved = await resolveTypeName(typeId);
  if (!isNumericText(cachedOrResolved)) {
    return cachedOrResolved;
  }

  const response = await fetch(`https://ref-data.everef.net/types/${typeId}`);
  if (response.ok) {
    const body = (await response.json()) as { name?: { en?: string } };
    const fromRefData = body.name?.en?.trim();
    if (fromRefData) {
      return fromRefData;
    }
  }

  return cachedOrResolved;
}

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function fuzzyMatch(query: string, candidate: string): boolean {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q) {
    return true;
  }
  if (c.includes(q)) {
    return true;
  }

  let qi = 0;
  for (let i = 0; i < c.length && qi < q.length; i += 1) {
    if (c[i] === q[qi]) {
      qi += 1;
    }
  }
  return qi === q.length;
}

export async function syncCharacterFittings(characterId: number, accessToken: string): Promise<{ count: number; syncedAt: string }> {
  const fittings = await getFittings(characterId, accessToken);
  const index = await writeFittings(characterId, fittings);
  return {
    count: index.fittings.length,
    syncedAt: index.updatedAt
  };
}

export async function listGroupedFittings(characterId: number, query: string): Promise<{ updatedAt: string | null; groups: GroupedFit[] }> {
  const index = await tryReadIndex(characterId);
  const storedFittings = await listStoredFittings(characterId);
  const syncedIds = new Set(index?.fittings.map((fitting) => fitting.fittingId) ?? []);
  if (storedFittings.length === 0) {
    return { updatedAt: index?.updatedAt ?? null, groups: [] };
  }

  const groupMap = new Map<number, GroupedFit>();
  for (const fitting of storedFittings) {
    if (!fuzzyMatch(query, fitting.name)) {
      continue;
    }

    if (!groupMap.has(fitting.shipTypeId)) {
      groupMap.set(fitting.shipTypeId, {
        shipTypeId: fitting.shipTypeId,
        shipTypeName: await resolveShipTypeName(fitting.shipTypeId),
        fittings: []
      });
    }

    groupMap.get(fitting.shipTypeId)?.fittings.push({
      fittingId: fitting.fittingId,
      name: fitting.name,
      isSyncedToEve: syncedIds.has(fitting.fittingId)
    });
  }

  const groups = Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      fittings: group.fittings.sort((a, b) => a.name.localeCompare(b.name))
    }))
    .sort((a, b) => a.shipTypeName.localeCompare(b.shipTypeName));

  return {
    updatedAt: index?.updatedAt ?? null,
    groups
  };
}

export async function getFittingDetail(characterId: number, fittingId: number): Promise<{
  fitting: EsiFitting;
  canRemoveFromEve: boolean;
  canSyncToEve: boolean;
  shipTypeId: number;
  shipTypeName: string;
  fittingName: string;
  itemTypeNames: Record<string, string>;
  itemNamesByFlag: Record<string, string>;
}> {
  const fitting = await readFitting(characterId, fittingId);
  const index = await tryReadIndex(characterId);
  const existsInLatest = Boolean(index?.fittings.some((item) => item.fittingId === fittingId));
  const shipTypeName = await resolveShipTypeName(fitting.ship_type_id);
  const typeIds = Array.from(new Set(fitting.items.map((item) => item.type_id)));
  const resolvedNames = await Promise.all(
    typeIds.map(async (typeId) => ({
      typeId,
      typeName: await resolveTypeNameForUi(typeId)
    }))
  );
  const itemTypeNames = Object.fromEntries(resolvedNames.map((entry) => [String(entry.typeId), entry.typeName]));
  const itemNamesByFlag: Record<string, string> = {};
  for (const item of fitting.items) {
    if (typeof item.flag !== "string") {
      continue;
    }
    itemNamesByFlag[item.flag] = itemTypeNames[String(item.type_id)] ?? String(item.type_id);
  }
  return {
    fitting,
    canRemoveFromEve: existsInLatest,
    canSyncToEve: !existsInLatest,
    shipTypeId: fitting.ship_type_id,
    shipTypeName,
    fittingName: fitting.name,
    itemTypeNames,
    itemNamesByFlag
  };
}

export async function removeFittingFromEve(characterId: number, fittingId: number, accessToken: string): Promise<void> {
  await deleteFitting(characterId, fittingId, accessToken);
}

export async function syncStoredFittingToEve(characterId: number, fittingId: number, accessToken: string): Promise<number> {
  const fitting = await readFitting(characterId, fittingId);
  return createFitting(characterId, accessToken, fitting);
}

export async function deleteStoredFittingPermanently(characterId: number, fittingId: number): Promise<boolean> {
  return deleteStoredFitting(characterId, fittingId);
}

type SlotBucket = {
  low: Array<{ index: number; text: string }>;
  medium: Array<{ index: number; text: string }>;
  high: Array<{ index: number; text: string }>;
  rig: Array<{ index: number; text: string }>;
  drones: string[];
  cargo: string[];
};

function toIndex(flag: string, prefix: string): number {
  const suffix = flag.slice(prefix.length);
  const parsed = Number(suffix);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function formatQuantity(name: string, quantity: number): string {
  return quantity > 1 ? `${name} x${quantity}` : name;
}

function pushByFlag(bucket: SlotBucket, flag: number | string, text: string): void {
  if (typeof flag !== "string") {
    return;
  }

  if (flag.startsWith("LoSlot")) {
    bucket.low.push({ index: toIndex(flag, "LoSlot"), text });
    return;
  }
  if (flag.startsWith("MedSlot")) {
    bucket.medium.push({ index: toIndex(flag, "MedSlot"), text });
    return;
  }
  if (flag.startsWith("HiSlot")) {
    bucket.high.push({ index: toIndex(flag, "HiSlot"), text });
    return;
  }
  if (flag.startsWith("RigSlot")) {
    bucket.rig.push({ index: toIndex(flag, "RigSlot"), text });
    return;
  }
  if (flag === "DroneBay") {
    bucket.drones.push(text);
    return;
  }
  if (flag === "Cargo") {
    bucket.cargo.push(text);
  }
}

export async function getFittingEft(characterId: number, fittingId: number): Promise<string> {
  const fitting = await readFitting(characterId, fittingId);
  const shipTypeName = await resolveShipTypeName(fitting.ship_type_id);

  const typeIds = Array.from(new Set(fitting.items.map((item) => item.type_id)));
  const namePairs = await Promise.all(
    typeIds.map(async (typeId) => ({
      typeId,
      typeName: await resolveTypeName(typeId)
    }))
  );
  const typeNameById = new Map<number, string>(namePairs.map((pair) => [pair.typeId, pair.typeName]));

  const bucket: SlotBucket = {
    low: [],
    medium: [],
    high: [],
    rig: [],
    drones: [],
    cargo: []
  };

  for (const item of fitting.items) {
    const typeName = typeNameById.get(item.type_id) ?? String(item.type_id);
    pushByFlag(bucket, item.flag, formatQuantity(typeName, item.quantity));
  }

  const sortByIndex = (left: { index: number }, right: { index: number }) => left.index - right.index;
  const lines = [
    `[${shipTypeName}, ${fitting.name}]`,
    ...bucket.low.sort(sortByIndex).map((entry) => entry.text),
    "",
    ...bucket.medium.sort(sortByIndex).map((entry) => entry.text),
    "",
    ...bucket.high.sort(sortByIndex).map((entry) => entry.text),
    "",
    ...bucket.rig.sort(sortByIndex).map((entry) => entry.text),
    "",
    ...bucket.drones,
    "",
    ...bucket.cargo
  ];

  return `${lines.join("\n")}\n`;
}

type JaniceAppraisalResponse = {
  code?: string;
  immediatePrices?: {
    totalSplitPrice?: number;
  };
  effectivePrices?: {
    totalSplitPrice?: number;
  };
};

type JaniceCacheEntry = {
  totalIsk: number;
  appraisalUrl?: string | null;
  expiresAt: number;
};

const JANICE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const JANICE_CACHE_DIR = path.join(env.fitsStorageRoot, ".janice-cache");

function toJaniceCacheKey(eft: string): string {
  return createHash("sha256").update(`market=2|pricing=split|${eft}`).digest("hex");
}

function toJaniceCachePath(cacheKey: string): string {
  return path.join(JANICE_CACHE_DIR, `${cacheKey}.json`);
}

async function readJaniceCachedTotal(cacheKey: string): Promise<{ totalIsk: number; appraisalUrl: string | null } | null> {
  try {
    const file = await readFile(toJaniceCachePath(cacheKey), "utf8");
    const parsed = JSON.parse(file) as JaniceCacheEntry;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.totalIsk !== "number" ||
      !Number.isFinite(parsed.totalIsk) ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (parsed.expiresAt <= Date.now()) {
      return null;
    }
    return {
      totalIsk: parsed.totalIsk,
      appraisalUrl: typeof parsed.appraisalUrl === "string" ? parsed.appraisalUrl : null
    };
  } catch {
    return null;
  }
}

async function writeJaniceCachedTotal(cacheKey: string, totalIsk: number, appraisalUrl: string | null): Promise<void> {
  const entry: JaniceCacheEntry = {
    totalIsk,
    appraisalUrl,
    expiresAt: Date.now() + JANICE_CACHE_TTL_MS
  };
  await mkdir(JANICE_CACHE_DIR, { recursive: true });
  await writeFile(toJaniceCachePath(cacheKey), JSON.stringify(entry), "utf8");
}

export async function getFittingPriceEstimate(
  characterId: number,
  fittingId: number
): Promise<{ totalIsk: number; appraisalUrl: string | null }> {
  const eft = await getFittingEft(characterId, fittingId);
  const cacheKey = toJaniceCacheKey(eft);
  const cachedEntry = await readJaniceCachedTotal(cacheKey);
  if (cachedEntry !== null) {
    return cachedEntry;
  }

  const response = await fetch("https://janice.e-351.com/api/rest/v2/appraisal?market=2&pricing=split", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "X-ApiKey": env.janiceApiKey
    },
    body: eft
  });
  if (!response.ok) {
    throw new Error(`Janice appraisal failed with status ${response.status}`);
  }

  const appraisal = (await response.json()) as JaniceAppraisalResponse;
  const totalCandidate = appraisal.immediatePrices?.totalSplitPrice ?? appraisal.effectivePrices?.totalSplitPrice;
  if (typeof totalCandidate !== "number" || !Number.isFinite(totalCandidate)) {
    throw new Error("Janice appraisal returned an invalid total");
  }

  const appraisalUrl =
    typeof appraisal.code === "string" && appraisal.code.trim()
      ? `https://janice.e-351.com/a/${appraisal.code.trim()}`
      : null;

  await writeJaniceCachedTotal(cacheKey, totalCandidate, appraisalUrl);
  return { totalIsk: totalCandidate, appraisalUrl };
}
