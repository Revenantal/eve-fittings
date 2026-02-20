import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { env } from "@/server/config/env";

const SESSION_DIR = path.join(env.fitsStorageRoot, "sessions");

export type SessionRecord = {
  sessionId: string;
  characterId: number;
  encryptedRefreshToken: string;
  createdAt: string;
  updatedAt: string;
};

function isExpired(record: SessionRecord): boolean {
  const updatedAtMs = Date.parse(record.updatedAt);
  if (!Number.isFinite(updatedAtMs)) {
    return true;
  }
  const ttlMs = env.sessionTtlHours * 60 * 60 * 1000;
  return Date.now() - updatedAtMs > ttlMs;
}

async function ensureSessionDir(): Promise<void> {
  await fs.mkdir(SESSION_DIR, { recursive: true });
}

function sessionPath(sessionId: string): string {
  return path.join(SESSION_DIR, `${sessionId}.json`);
}

async function atomicWriteJson(filePath: string, payload: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `${path.basename(filePath)}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
  const serialized = JSON.stringify(payload, null, 2);
  await fs.writeFile(tmp, serialized, "utf8");
  try {
    await fs.rename(tmp, filePath);
    return;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") {
      throw error;
    }
    // OneDrive/AV can briefly lock files; degrade to direct write for session continuity.
    await fs.writeFile(filePath, serialized, "utf8");
    try {
      await fs.unlink(tmp);
    } catch {
      // Ignore temp cleanup failures.
    }
  }
}

export async function createSession(record: SessionRecord): Promise<void> {
  await ensureSessionDir();
  await atomicWriteJson(sessionPath(record.sessionId), record);
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  try {
    const raw = await fs.readFile(sessionPath(sessionId), "utf8");
    const record = JSON.parse(raw) as SessionRecord;
    if (isExpired(record)) {
      await deleteSession(sessionId);
      return null;
    }
    return record;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await fs.unlink(sessionPath(sessionId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
