import { jsonError, jsonOk } from "@/lib/http/response";
import { getRequestId } from "@/lib/http/request-id";
import { removeFittingFromEve, syncCharacterFittings } from "@/lib/fits/service";
import { withCharacterLock } from "@/lib/storage/lock";
import { validateCsrfHeader } from "@/server/auth/csrf";
import { requireAuthenticatedEsiContext } from "@/server/auth/esi-context";
import { logger } from "@/server/logging/logger";

export const dynamic = "force-dynamic";

type RemoveRequest = {
  confirm?: boolean;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ fittingId: string }> }
): Promise<Response> {
  const requestId = getRequestId(request);
  if (!(await validateCsrfHeader())) {
    logger.warn("fit_remove_csrf_rejected", { requestId });
    return jsonError(403, "Invalid CSRF token");
  }

  const payload = (await request.json().catch(() => ({}))) as RemoveRequest;
  if (!payload.confirm) {
    logger.warn("fit_remove_missing_confirmation", { requestId });
    return jsonError(400, "Missing confirmation");
  }

  const { fittingId: fittingIdRaw } = await context.params;
  const fittingId = Number(fittingIdRaw);
  if (!Number.isFinite(fittingId)) {
    logger.warn("fit_remove_invalid_id", { requestId, fittingIdRaw });
    return jsonError(400, "Invalid fitting id");
  }

  try {
    const { characterId, accessToken } = await requireAuthenticatedEsiContext();
    logger.info("fit_remove_started", { requestId, characterId, fittingId });
    const result = await withCharacterLock(characterId, async () => {
      await removeFittingFromEve(characterId, fittingId, accessToken);
      try {
        const refresh = await syncCharacterFittings(characterId, accessToken);
        logger.info("fit_remove_refresh_completed", { requestId, characterId, fittingId, stale: false });
        return { removed: true, stale: false, refresh };
      } catch {
        logger.warn("fit_remove_refresh_failed", { requestId, characterId, fittingId, stale: true });
        return { removed: true, stale: true };
      }
    });

    logger.info("fit_remove_completed", { requestId, characterId, fittingId, stale: result.stale });
    return jsonOk(result);
  } catch (error) {
    logger.error("fit_remove_failed", { requestId, fittingId, message: (error as Error).message });
    return jsonError(500, "Remove failed", (error as Error).message);
  }
}
