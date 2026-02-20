import "server-only";

import { createFitting, deleteFitting, getFittings } from "@/server/esi/client";
import type { EsiFitting } from "@/server/esi/types";
import { deleteStoredFitting, listStoredFittings, readFitting, tryReadIndex, writeFittings } from "@/lib/storage/fits-store";
import { resolveShipTypeName, resolveTypeName } from "@/lib/ship-types/cache";

export type GroupedFit = {
  shipTypeId: number;
  shipTypeName: string;
  fittings: Array<{
    fittingId: number;
    name: string;
    isSyncedToEve: boolean;
  }>;
};

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
}> {
  const fitting = await readFitting(characterId, fittingId);
  const index = await tryReadIndex(characterId);
  const existsInLatest = Boolean(index?.fittings.some((item) => item.fittingId === fittingId));
  const shipTypeName = await resolveShipTypeName(fitting.ship_type_id);
  return {
    fitting,
    canRemoveFromEve: existsInLatest,
    canSyncToEve: !existsInLatest,
    shipTypeId: fitting.ship_type_id,
    shipTypeName,
    fittingName: fitting.name
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
