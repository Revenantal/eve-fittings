import "server-only";

import { HttpError } from "@/lib/http/errors";

const AUTH_MESSAGES = new Set(["Not authenticated", "Session not found"]);

export type ClassifiedRouteError = {
  status: number;
  error: string;
};

export function classifyRouteError(
  error: unknown,
  options: {
    fallbackError: string;
    notFoundError?: string;
  }
): ClassifiedRouteError {
  const message = error instanceof Error ? error.message : "";
  if (AUTH_MESSAGES.has(message)) {
    return { status: 401, error: "Unauthorized" };
  }

  if (error instanceof HttpError) {
    if (error.status === 401 || error.status === 403) {
      return { status: 401, error: "Unauthorized" };
    }
    if (error.status === 404 && options.notFoundError) {
      return { status: 404, error: options.notFoundError };
    }
    if (error.status === 429) {
      return { status: 503, error: "Upstream service rate-limited the request" };
    }
  }

  const errno = error as NodeJS.ErrnoException;
  if (errno.code === "ENOENT" && options.notFoundError) {
    return { status: 404, error: options.notFoundError };
  }

  return { status: 500, error: options.fallbackError };
}
