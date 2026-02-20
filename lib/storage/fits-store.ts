import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { env } from "@/server/config/env";
import type { EsiFitting } from "@/server/esi/types";

export type FitIndexRecord = {
  fittingId: number;
  name: string;
  shipTypeId: number;
  path: string;
};

export type FitIndex = {
  characterId: number;
  updatedAt: string;
  fittings: FitIndexRecord[];
};

function sanitizeSegment(segment: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(segment)) {
    throw new Error("Invalid path segment");
  }
  return segment;
}

function characterDir(characterId: number): string {
  return path.join(env.fitsStorageRoot, sanitizeSegment(String(characterId)));
}

function fittingPath(characterId: number, fittingId: number): string {
  return path.join(characterDir(characterId), `${sanitizeSegment(String(fittingId))}.json`);
}

function indexPath(characterId: number): string {
  return path.join(characterDir(characterId), "index.json");
}

async function atomicWriteJson(filePath: string, payload: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = path.join(dir, `${path.basename(filePath)}.${Date.now()}.tmp`);
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

export async function ensureStorageRoot(): Promise<void> {
  await fs.mkdir(env.fitsStorageRoot, { recursive: true });
}

export async function writeFittings(characterId: number, fittings: EsiFitting[]): Promise<FitIndex> {
  const records: FitIndexRecord[] = [];

  for (const fitting of fittings) {
    const pathToFit = fittingPath(characterId, fitting.fitting_id);
    await atomicWriteJson(pathToFit, fitting);
    records.push({
      fittingId: fitting.fitting_id,
      name: fitting.name,
      shipTypeId: fitting.ship_type_id,
      path: pathToFit
    });
  }

  const index: FitIndex = {
    characterId,
    updatedAt: new Date().toISOString(),
    fittings: records.sort((a, b) => a.name.localeCompare(b.name))
  };

  await atomicWriteJson(indexPath(characterId), index);
  return index;
}

export async function readIndex(characterId: number): Promise<FitIndex> {
  const raw = await fs.readFile(indexPath(characterId), "utf8");
  return JSON.parse(raw) as FitIndex;
}

export async function tryReadIndex(characterId: number): Promise<FitIndex | null> {
  try {
    return await readIndex(characterId);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function readFitting(characterId: number, fittingId: number): Promise<EsiFitting> {
  const raw = await fs.readFile(fittingPath(characterId, fittingId), "utf8");
  return JSON.parse(raw) as EsiFitting;
}

export async function fittingFileExists(characterId: number, fittingId: number): Promise<boolean> {
  try {
    await fs.access(fittingPath(characterId, fittingId));
    return true;
  } catch {
    return false;
  }
}

export async function listStoredFittings(
  characterId: number
): Promise<Array<{ fittingId: number; name: string; shipTypeId: number }>> {
  try {
    const entries = await fs.readdir(characterDir(characterId), { withFileTypes: true });
    const summaries: Array<{ fittingId: number; name: string; shipTypeId: number }> = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name === "index.json") {
        continue;
      }

      const filePath = path.join(characterDir(characterId), entry.name);
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<EsiFitting>;
      const fittingId = Number(parsed.fitting_id);
      const shipTypeId = Number(parsed.ship_type_id);
      const name = typeof parsed.name === "string" ? parsed.name : "";

      if (!Number.isFinite(fittingId) || !Number.isFinite(shipTypeId) || !name) {
        continue;
      }

      summaries.push({
        fittingId,
        shipTypeId,
        name
      });
    }

    return summaries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function deleteStoredFitting(characterId: number, fittingId: number): Promise<boolean> {
  let removed = false;
  try {
    await fs.unlink(fittingPath(characterId, fittingId));
    removed = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const index = await tryReadIndex(characterId);
  if (!index) {
    return removed;
  }

  const nextFittings = index.fittings.filter((fit) => fit.fittingId !== fittingId);
  if (nextFittings.length === index.fittings.length) {
    return removed;
  }

  const nextIndex: FitIndex = {
    ...index,
    fittings: nextFittings
  };
  await atomicWriteJson(indexPath(characterId), nextIndex);
  return true;
}
