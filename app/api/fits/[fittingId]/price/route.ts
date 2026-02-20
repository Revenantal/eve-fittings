import { jsonError, jsonOk } from "@/lib/http/response";
import { getRequestId } from "@/lib/http/request-id";
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
    return jsonOk(estimate);
  } catch (error) {
    logger.warn("fit_price_failed", { requestId, fittingId, message: (error as Error).message });
    return jsonError(404, "Unable to estimate fitting price", (error as Error).message);
  }
}
