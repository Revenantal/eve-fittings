import { jsonError, jsonOk } from "@/lib/http/response";
import { getRequestId } from "@/lib/http/request-id";
import { logger } from "@/server/logging/logger";
import { validateCsrfHeader } from "@/server/auth/csrf";
import { logoutCurrentSession } from "@/server/auth/session-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  if (!(await validateCsrfHeader())) {
    logger.warn("logout_csrf_rejected", { requestId });
    return jsonError(403, "Invalid CSRF token");
  }

  await logoutCurrentSession();
  logger.info("logout_success", { requestId });
  return jsonOk({ ok: true });
}
