import { jsonError, jsonOk } from "@/lib/http/response";
import { getRequestId } from "@/lib/http/request-id";
import { syncCharacterFittings, syncStoredFittingToEve } from "@/lib/fits/service";
import { withCharacterLock } from "@/lib/storage/lock";
import { validateCsrfHeader } from "@/server/auth/csrf";
import { requireAuthenticatedEsiContext } from "@/server/auth/esi-context";
import { logger } from "@/server/logging/logger";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ fittingId: string }> }
): Promise<Response> {
  const requestId = getRequestId(request);
  if (!(await validateCsrfHeader())) {
    logger.warn("fit_sync_one_csrf_rejected", { requestId });
    return jsonError(403, "Invalid CSRF token");
  }

  const { fittingId: fittingIdRaw } = await context.params;
  const fittingId = Number(fittingIdRaw);
  if (!Number.isFinite(fittingId)) {
    logger.warn("fit_sync_one_invalid_id", { requestId, fittingIdRaw });
    return jsonError(400, "Invalid fitting id");
  }

  try {
    const { characterId, accessToken } = await requireAuthenticatedEsiContext();
    logger.info("fit_sync_one_started", { requestId, characterId, fittingId });
    const result = await withCharacterLock(characterId, async () => {
      const newFittingId = await syncStoredFittingToEve(characterId, fittingId, accessToken);
      try {
        const refresh = await syncCharacterFittings(characterId, accessToken);
        logger.info("fit_sync_one_refresh_completed", { requestId, characterId, fittingId, stale: false });
        return { synced: true, newFittingId, stale: false, refresh };
      } catch {
        logger.warn("fit_sync_one_refresh_failed", { requestId, characterId, fittingId, stale: true });
        return { synced: true, newFittingId, stale: true };
      }
    });

    logger.info("fit_sync_one_completed", { requestId, characterId, fittingId, stale: result.stale });
    return jsonOk(result);
  } catch (error) {
    logger.error("fit_sync_one_failed", { requestId, fittingId, message: (error as Error).message });
    return jsonError(500, "Sync failed", (error as Error).message);
  }
}
