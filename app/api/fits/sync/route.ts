import { jsonError, jsonOk } from "@/lib/http/response";
import { getRequestId } from "@/lib/http/request-id";
import { syncCharacterFittings } from "@/lib/fits/service";
import { withCharacterLock } from "@/lib/storage/lock";
import { validateCsrfHeader } from "@/server/auth/csrf";
import { requireAuthenticatedEsiContext } from "@/server/auth/esi-context";
import { env } from "@/server/config/env";
import { consumeSyncSlot } from "@/server/esi/sync-throttle";
import { logger } from "@/server/logging/logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  if (!(await validateCsrfHeader())) {
    logger.warn("fit_sync_csrf_rejected", { requestId });
    return jsonError(403, "Invalid CSRF token");
  }

  try {
    const { characterId, accessToken } = await requireAuthenticatedEsiContext();
    const slot = consumeSyncSlot(characterId, env.syncMinIntervalSeconds * 1000);
    if (!slot.allowed) {
      logger.warn("fit_sync_throttled", { requestId, characterId, retryAfterSeconds: slot.retryAfterSeconds });
      return jsonError(429, "Sync recently requested. Please retry shortly.", {
        retryAfterSeconds: slot.retryAfterSeconds
      });
    }

    logger.info("fit_sync_started", { requestId, characterId });
    const summary = await withCharacterLock(characterId, () => syncCharacterFittings(characterId, accessToken));
    logger.info("fit_sync_completed", { requestId, characterId, count: summary.count, syncedAt: summary.syncedAt });
    return jsonOk(summary);
  } catch (error) {
    logger.warn("fit_sync_failed", { requestId, message: (error as Error).message });
    return jsonError(401, "Unauthorized", (error as Error).message);
  }
}
