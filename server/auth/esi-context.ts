import "server-only";

import { getSessionIdFromCookie } from "@/server/auth/cookies";
import { getAccessTokenForSession } from "@/server/auth/session-service";

export async function requireAuthenticatedEsiContext(): Promise<{ sessionId: string; characterId: number; accessToken: string }> {
  const sessionId = await getSessionIdFromCookie();
  if (!sessionId) {
    throw new Error("Not authenticated");
  }
  const { accessToken, characterId } = await getAccessTokenForSession(sessionId);
  return {
    sessionId,
    characterId,
    accessToken
  };
}