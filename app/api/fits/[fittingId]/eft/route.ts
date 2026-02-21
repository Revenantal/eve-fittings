import { jsonError, jsonOk } from "@/lib/http/response";
import { getRequestId } from "@/lib/http/request-id";
import { PRIVATE_NO_STORE_HEADERS } from "@/lib/http/cache";
import { getFittingEft } from "@/lib/fits/service";
import { requireAuthenticatedEsiContext } from "@/server/auth/esi-context";
import { logger } from "@/server/logging/logger";

export const dynamic = "force-dynamic";

function classifyEftError(error: unknown): { status: number; error: string } {
  const err = error as NodeJS.ErrnoException;
  const message = (error as Error).message ?? "";
  if (message === "Not authenticated" || message === "Session not found") {
    return { status: 401, error: "Unauthorized" };
  }
  if (err.code === "ENOENT") {
    return { status: 404, error: "Fitting not found" };
  }
  return { status: 500, error: "Unable to load fitting EFT" };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ fittingId: string }> }
): Promise<Response> {
  const requestId = getRequestId(request);
  const { fittingId: fittingIdRaw } = await context.params;
  const fittingId = Number(fittingIdRaw);
  if (!Number.isFinite(fittingId)) {
    logger.warn("fit_eft_invalid_id", { requestId, fittingIdRaw });
    return jsonError(400, "Invalid fitting id");
  }

  try {
    const { characterId } = await requireAuthenticatedEsiContext();
    const eft = await getFittingEft(characterId, fittingId);
    logger.info("fit_eft_loaded", { requestId, characterId, fittingId });
    return jsonOk({ eft }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    const classified = classifyEftError(error);
    const log = classified.status >= 500 ? logger.error : logger.warn;
    log("fit_eft_failed", { requestId, fittingId, status: classified.status, message: (error as Error).message });
    return jsonError(classified.status, classified.error, (error as Error).message);
  }
}
