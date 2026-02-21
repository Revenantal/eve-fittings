import { jsonError, jsonOk } from "@/lib/http/response";
import { classifyRouteError } from "@/lib/http/error-classification";
import { getRequestId } from "@/lib/http/request-id";
import { PRIVATE_NO_STORE_HEADERS } from "@/lib/http/cache";
import { getFittingDetail, getFittingEft, getFittingPriceEstimate } from "@/lib/fits/service";
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
    logger.warn("fit_bundle_invalid_id", { requestId, fittingIdRaw });
    return jsonError(400, "Invalid fitting id");
  }

  try {
    const { characterId } = await requireAuthenticatedEsiContext();
    const detail = await getFittingDetail(characterId, fittingId);
    const [eftResult, priceResult] = await Promise.allSettled([
      getFittingEft(characterId, fittingId),
      getFittingPriceEstimate(characterId, fittingId)
    ]);

    if (eftResult.status === "rejected") {
      logger.warn("fit_bundle_eft_partial_failure", {
        requestId,
        characterId,
        fittingId,
        message: (eftResult.reason as Error)?.message ?? "unknown"
      });
    }
    if (priceResult.status === "rejected") {
      logger.warn("fit_bundle_price_partial_failure", {
        requestId,
        characterId,
        fittingId,
        message: (priceResult.reason as Error)?.message ?? "unknown"
      });
    }

    logger.info("fit_bundle_loaded", { requestId, characterId, fittingId });
    return jsonOk(
      {
        detail,
        eft: eftResult.status === "fulfilled" ? eftResult.value : "Unable to load EFT format.",
        price: priceResult.status === "fulfilled" ? priceResult.value : null
      },
      { headers: PRIVATE_NO_STORE_HEADERS }
    );
  } catch (error) {
    const classified = classifyRouteError(error, {
      fallbackError: "Unable to load fitting bundle",
      notFoundError: "Fitting not found"
    });
    const log = classified.status >= 500 ? logger.error : logger.warn;
    log("fit_bundle_failed", { requestId, fittingId, status: classified.status, message: (error as Error).message });
    return jsonError(classified.status, classified.error);
  }
}
