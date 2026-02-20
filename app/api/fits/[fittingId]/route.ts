import { jsonError, jsonOk } from "@/lib/http/response";
import { getRequestId } from "@/lib/http/request-id";
import { deleteStoredFittingPermanently, getFittingDetail } from "@/lib/fits/service";
import { withCharacterLock } from "@/lib/storage/lock";
import { validateCsrfHeader } from "@/server/auth/csrf";
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
    logger.warn("fit_detail_invalid_id", { requestId, fittingIdRaw });
    return jsonError(400, "Invalid fitting id");
  }

  try {
    const { characterId } = await requireAuthenticatedEsiContext();
    const detail = await getFittingDetail(characterId, fittingId);
    logger.info("fit_detail_loaded", { requestId, characterId, fittingId });
    return jsonOk(detail);
  } catch (error) {
    logger.warn("fit_detail_failed", { requestId, fittingId, message: (error as Error).message });
    return jsonError(404, "Fitting not found", (error as Error).message);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ fittingId: string }> }
): Promise<Response> {
  const requestId = getRequestId(request);
  if (!(await validateCsrfHeader())) {
    logger.warn("fit_delete_local_csrf_rejected", { requestId });
    return jsonError(403, "Invalid CSRF token");
  }

  const { fittingId: fittingIdRaw } = await context.params;
  const fittingId = Number(fittingIdRaw);
  if (!Number.isFinite(fittingId)) {
    logger.warn("fit_delete_local_invalid_id", { requestId, fittingIdRaw });
    return jsonError(400, "Invalid fitting id");
  }

  try {
    const { characterId } = await requireAuthenticatedEsiContext();
    const removed = await withCharacterLock(characterId, () => deleteStoredFittingPermanently(characterId, fittingId));
    if (!removed) {
      logger.warn("fit_delete_local_missing", { requestId, characterId, fittingId });
      return jsonError(404, "Fitting not found");
    }
    logger.info("fit_delete_local_completed", { requestId, characterId, fittingId });
    return jsonOk({ deleted: true });
  } catch (error) {
    logger.error("fit_delete_local_failed", { requestId, fittingId, message: (error as Error).message });
    return jsonError(500, "Delete failed", (error as Error).message);
  }
}
