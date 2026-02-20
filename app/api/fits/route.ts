import { jsonError, jsonOk } from "@/lib/http/response";
import { getRequestId } from "@/lib/http/request-id";
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
    return jsonOk(result);
  } catch (error) {
    logger.warn("fit_list_failed", { requestId, message: (error as Error).message });
    return jsonError(401, "Unauthorized", (error as Error).message);
  }
}
