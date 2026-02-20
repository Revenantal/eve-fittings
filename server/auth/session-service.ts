import "server-only";

import { createSession, deleteSession, getSession } from "@/server/auth/session-store";
import { decryptString, encryptString, randomId } from "@/server/security/crypto";
import { clearCsrfCookie, clearSessionCookie, getSessionIdFromCookie, setSessionCookie } from "@/server/auth/cookies";
import { refreshAccessToken } from "@/server/esi/client";

export async function createUserSession(characterId: number, refreshToken: string): Promise<string> {
  const sessionId = randomId();
  const now = new Date().toISOString();
  await createSession({
    sessionId,
    characterId,
    encryptedRefreshToken: encryptString(refreshToken),
    createdAt: now,
    updatedAt: now
  });
  await setSessionCookie(sessionId);
  return sessionId;
}

export async function rotateRefreshToken(sessionId: string, characterId: number, refreshToken: string): Promise<void> {
  const now = new Date().toISOString();
  const existing = await getSession(sessionId);
  await createSession({
    sessionId,
    characterId,
    encryptedRefreshToken: encryptString(refreshToken),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });
}

export async function getAccessTokenForSession(sessionId: string): Promise<{ accessToken: string; characterId: number }> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const refreshToken = decryptString(session.encryptedRefreshToken);
  const tokens = await refreshAccessToken(refreshToken);
  const nextRefresh = tokens.refresh_token || refreshToken;

  await rotateRefreshToken(session.sessionId, session.characterId, nextRefresh);

  return {
    accessToken: tokens.access_token,
    characterId: session.characterId
  };
}

export async function logoutCurrentSession(): Promise<void> {
  const sessionId = await getSessionIdFromCookie();
  if (sessionId) {
    await deleteSession(sessionId);
  }
  await clearSessionCookie();
  await clearCsrfCookie();
}
