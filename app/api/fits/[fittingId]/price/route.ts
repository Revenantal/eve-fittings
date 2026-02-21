import { jsonError, jsonOk } from "@/lib/http/response";
import { classifyRouteError } from "@/lib/http/error-classification";
import { getRequestId } from "@/lib/http/request-id";
import { PRIVATE_NO_STORE_HEADERS } from "@/lib/http/cache";
import { getFittingPriceEstimate } from "@/lib/fits/service";
import { requireAuthenticatedEsiContext } from "@/server/auth/esi-context";
import { logger } from "@/server/logging/logger";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ fittingId: string }> }
): Promise<Response> {
  const requestId = getRequestId(request);
  const { fittingId: fittingIdRaw } = await context.params;
  const fittingId = Number(fittingIdRaw);
  if (!Number.isFinite(fittingId)) {
    logger.warn("fit_price_invalid_id", { requestId, fittingIdRaw });
    return jsonError(400, "Invalid fitting id");
  }

  try {
    const { characterId } = await requireAuthenticatedEsiContext();
    const estimate = await getFittingPriceEstimate(characterId, fittingId);
    logger.info("fit_price_loaded", { requestId, characterId, fittingId });
    return jsonOk(estimate, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    const classified = classifyRouteError(error, {
      fallbackError: "Unable to estimate fitting price",
      notFoundError: "Unable to estimate fitting price"
    });
    const log = classified.status >= 500 ? logger.error : logger.warn;
    log("fit_price_failed", { requestId, fittingId, status: classified.status, message: (error as Error).message });
    return jsonError(classified.status, classified.error);
  }
}
