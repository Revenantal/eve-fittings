import { NextResponse } from "next/server";

import { getRequestId } from "@/lib/http/request-id";
import { setOauthStateCookie } from "@/server/auth/cookies";
import { getAuthorizeUrl } from "@/server/esi/client";
import { logger } from "@/server/logging/logger";
import { randomId } from "@/server/security/crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);
  const state = randomId(16);
  await setOauthStateCookie(state);
  const redirectUrl = getAuthorizeUrl(state);
  logger.info("oauth_login_redirect", { requestId });
  return NextResponse.redirect(redirectUrl);
}
