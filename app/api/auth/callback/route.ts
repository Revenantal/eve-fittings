import { NextRequest, NextResponse } from "next/server";

import { createCsrfToken } from "@/server/auth/csrf";
import { clearOauthStateCookie, getOauthStateCookie, setCsrfCookie } from "@/server/auth/cookies";
import { createUserSession } from "@/server/auth/session-service";
import { exchangeCodeForTokens, verifyAccessToken } from "@/server/esi/client";
import { syncCharacterFittings } from "@/lib/fits/service";
import { getRequestId } from "@/lib/http/request-id";
import { logger } from "@/server/logging/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(request);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    logger.warn("oauth_callback_missing_params", { requestId });
    return NextResponse.json({ error: "Missing code/state" }, { status: 400 });
  }

  const expectedState = await getOauthStateCookie();
  await clearOauthStateCookie();

  if (!expectedState || state !== expectedState) {
    logger.warn("oauth_callback_invalid_state", { requestId });
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const verify = await verifyAccessToken(tokens.access_token);
    await createUserSession(verify.CharacterID, tokens.refresh_token);

    const csrfToken = createCsrfToken();
    await setCsrfCookie(csrfToken);

    try {
      await syncCharacterFittings(verify.CharacterID, tokens.access_token);
      logger.info("oauth_callback_initial_sync_completed", { requestId, characterId: verify.CharacterID });
    } catch {
      // Login should still complete even if initial sync fails.
      logger.warn("oauth_callback_initial_sync_failed", { requestId, characterId: verify.CharacterID });
    }

    logger.info("oauth_callback_success", { requestId, characterId: verify.CharacterID });
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    logger.error("oauth_callback_failed", {
      requestId,
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json({ error: "OAuth callback failed" }, { status: 500 });
  }
}
