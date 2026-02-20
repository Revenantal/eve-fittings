import "server-only";

import { headers } from "next/headers";

import { getCsrfCookie } from "@/server/auth/cookies";
import { randomId } from "@/server/security/crypto";

export function createCsrfToken(): string {
  return randomId(16);
}

export async function validateCsrfHeader(): Promise<boolean> {
  const expected = await getCsrfCookie();
  if (!expected) {
    return false;
  }
  const requestHeaders = await headers();
  const provided = requestHeaders.get("x-csrf-token");
  return Boolean(provided && provided === expected);
}