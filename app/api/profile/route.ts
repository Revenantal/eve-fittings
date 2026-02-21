import { jsonError, jsonOk } from "@/lib/http/response";
import { classifyRouteError } from "@/lib/http/error-classification";
import { getRequestId } from "@/lib/http/request-id";
import { loadPlayerProfile } from "@/lib/profile/service";
import { requireAuthenticatedEsiContext } from "@/server/auth/esi-context";
import { logger } from "@/server/logging/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  try {
    const { characterId, accessToken } = await requireAuthenticatedEsiContext();
    const profile = await loadPlayerProfile(characterId, accessToken);
    logger.info("profile_loaded", { requestId, characterId });
    return jsonOk(profile);
  } catch (error) {
    const classified = classifyRouteError(error, { fallbackError: "Unable to load profile" });
    const log = classified.status >= 500 ? logger.error : logger.warn;
    log("profile_load_failed", { requestId, status: classified.status, message: (error as Error).message });
    return jsonError(classified.status, classified.error);
  }
}
