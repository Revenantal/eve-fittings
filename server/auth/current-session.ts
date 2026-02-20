import "server-only";

import { decryptString } from "@/server/security/crypto";
import { getSessionIdFromCookie } from "@/server/auth/cookies";
import { getSession } from "@/server/auth/session-store";

export type CurrentSession = {
  sessionId: string;
  characterId: number;
  refreshToken: string;
};

export async function requireCurrentSession(): Promise<CurrentSession> {
  const sessionId = await getSessionIdFromCookie();
  if (!sessionId) {
    throw new Error("Not authenticated");
  }
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }
  return {
    sessionId: session.sessionId,
    characterId: session.characterId,
    refreshToken: decryptString(session.encryptedRefreshToken)
  };
}

export async function getCurrentSessionOrNull(): Promise<CurrentSession | null> {
  try {
    return await requireCurrentSession();
  } catch {
    return null;
  }
}