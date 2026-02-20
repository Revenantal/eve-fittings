import "server-only";

import { cookies } from "next/headers";

const SESSION_COOKIE = "eve_session";
const CSRF_COOKIE = "eve_csrf";
const OAUTH_STATE_COOKIE = "eve_oauth_state";

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function getSessionIdFromCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function setSessionCookie(sessionId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export async function setCsrfCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function getCsrfCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(CSRF_COOKIE)?.value ?? null;
}

export async function clearCsrfCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(CSRF_COOKIE, "", {
    httpOnly: false,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export async function setOauthStateCookie(state: string): Promise<void> {
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10
  });
}

export async function getOauthStateCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(OAUTH_STATE_COOKIE)?.value ?? null;
}

export async function clearOauthStateCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}