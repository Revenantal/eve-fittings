import "server-only";

import { createSession, deleteSession, getSession } from "@/server/auth/session-store";
import { decryptString, encryptString, randomId } from "@/server/security/crypto";
import { clearCsrfCookie, clearSessionCookie, getSessionIdFromCookie, setSessionCookie } from "@/server/auth/cookies";
import { refreshAccessToken } from "@/server/esi/client";
import { logger } from "@/server/logging/logger";

const ACCESS_TOKEN_REFRESH_SKEW_MS = 60 * 1000;

function toExpiresAt(nowMs: number, expiresInSeconds: number): string {
  const safeTtlMs = Math.max(0, Math.floor(expiresInSeconds * 1000));
  return new Date(nowMs + safeTtlMs).toISOString();
}

function canReuseAccessToken(
  session: Awaited<ReturnType<typeof getSession>>,
  nowMs: number
): session is NonNullable<Awaited<ReturnType<typeof getSession>>> & {
  encryptedAccessToken: string;
  accessTokenExpiresAt: string;
} {
  if (!session?.encryptedAccessToken || !session.accessTokenExpiresAt) {
    return false;
  }
  const expiryMs = Date.parse(session.accessTokenExpiresAt);
  if (!Number.isFinite(expiryMs)) {
    return false;
  }
  return expiryMs > nowMs + ACCESS_TOKEN_REFRESH_SKEW_MS;
}

export async function createUserSession(
  characterId: number,
  accessToken: string,
  accessTokenExpiresInSeconds: number,
  refreshToken: string
): Promise<string> {
  const sessionId = randomId();
  const now = new Date().toISOString();
  const nowMs = Date.now();
  await createSession({
    sessionId,
    characterId,
    encryptedRefreshToken: encryptString(refreshToken),
    encryptedAccessToken: encryptString(accessToken),
    accessTokenExpiresAt: toExpiresAt(nowMs, accessTokenExpiresInSeconds),
    createdAt: now,
    updatedAt: now
  });
  await setSessionCookie(sessionId);
  return sessionId;
}

export async function rotateRefreshToken(
  sessionId: string,
  characterId: number,
  createdAt: string,
  refreshToken: string,
  accessToken: string,
  accessTokenExpiresInSeconds: number
): Promise<void> {
  const now = new Date().toISOString();
  const nowMs = Date.now();
  await createSession({
    sessionId,
    characterId,
    encryptedRefreshToken: encryptString(refreshToken),
    encryptedAccessToken: encryptString(accessToken),
    accessTokenExpiresAt: toExpiresAt(nowMs, accessTokenExpiresInSeconds),
    createdAt,
    updatedAt: now
  });
}

export async function getAccessTokenForSession(sessionId: string): Promise<{ accessToken: string; characterId: number }> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const nowMs = Date.now();
  if (canReuseAccessToken(session, nowMs)) {
    return {
      accessToken: decryptString(session.encryptedAccessToken),
      characterId: session.characterId
    };
  }

  const refreshToken = decryptString(session.encryptedRefreshToken);
  const tokens = await refreshAccessToken(refreshToken);
  const nextRefresh = tokens.refresh_token || refreshToken;

  try {
    await rotateRefreshToken(
      session.sessionId,
      session.characterId,
      session.createdAt,
      nextRefresh,
      tokens.access_token,
      tokens.expires_in
    );
  } catch (error) {
    logger.warn("session_rotate_failed", {
      sessionId: session.sessionId,
      characterId: session.characterId,
      message: (error as Error).message
    });
  }

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
