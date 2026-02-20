import { jsonError, jsonOk } from "@/lib/http/response";
import { getRequestId } from "@/lib/http/request-id";
import { getFittingPyfa } from "@/lib/fits/service";
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
    logger.warn("fit_pyfa_invalid_id", { requestId, fittingIdRaw });
    return jsonError(400, "Invalid fitting id");
  }

  try {
    const { characterId } = await requireAuthenticatedEsiContext();
    const pyfa = await getFittingPyfa(characterId, fittingId);
    logger.info("fit_pyfa_loaded", { requestId, characterId, fittingId });
    return jsonOk({ pyfa });
  } catch (error) {
    logger.warn("fit_pyfa_failed", { requestId, fittingId, message: (error as Error).message });
    return jsonError(404, "Fitting not found", (error as Error).message);
  }
}
