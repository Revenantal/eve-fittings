import { jsonError, jsonOk } from "@/lib/http/response";
import { classifyRouteError } from "@/lib/http/error-classification";
import { getRequestId } from "@/lib/http/request-id";
import { PRIVATE_NO_STORE_HEADERS } from "@/lib/http/cache";
import { listGroupedFittings } from "@/lib/fits/service";
import { requireAuthenticatedEsiContext } from "@/server/auth/esi-context";
import { logger } from "@/server/logging/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  try {
    const { characterId } = await requireAuthenticatedEsiContext();
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const result = await listGroupedFittings(characterId, query);
    logger.info("fit_list_loaded", { requestId, characterId, queryLength: query.length, groups: result.groups.length });
    return jsonOk(result, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    const classified = classifyRouteError(error, { fallbackError: "Unable to load fittings" });
    const log = classified.status >= 500 ? logger.error : logger.warn;
    log("fit_list_failed", { requestId, status: classified.status, message: (error as Error).message });
    return jsonError(classified.status, classified.error);
  }
}
