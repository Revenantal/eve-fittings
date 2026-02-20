import "server-only";

import { env } from "@/server/config/env";
import { HttpError, parseJsonResponse } from "@/lib/http/errors";
import { logger } from "@/server/logging/logger";
import type {
  EsiAlliancePublicInfo,
  EsiCharacterPublicInfo,
  EsiCorporationPublicInfo,
  EsiFitting,
  EsiRateInfo,
  TokenResponse,
  VerifyResponse
} from "@/server/esi/types";

const ESI_BASE = "https://esi.evetech.net/latest";
const SSO_AUTHORIZE_URL = "https://login.eveonline.com/v2/oauth/authorize";
const SSO_TOKEN_URL = "https://login.eveonline.com/v2/oauth/token";
const SSO_VERIFY_URL = "https://login.eveonline.com/oauth/verify";

const REQUIRED_SCOPES = ["esi-fittings.read_fittings.v1", "esi-fittings.write_fittings.v1"];

function authHeaderValue(): string {
  const encoded = Buffer.from(`${env.eveClientId}:${env.eveClientSecret}`, "utf8").toString("base64");
  return `Basic ${encoded}`;
}

function rateInfoFromHeaders(headers: Headers): EsiRateInfo {
  return {
    group: headers.get("x-ratelimit-group"),
    limit: headers.get("x-ratelimit-limit"),
    remaining: headers.get("x-ratelimit-remaining"),
    used: headers.get("x-ratelimit-used")
  };
}

async function fetchWithRetry(url: string, init: RequestInit, retry = 1): Promise<Response> {
  const response = await fetch(url, init);
  if (response.status !== 429 || retry <= 0) {
    return response;
  }
  logger.warn("esi_rate_limit_encountered", {
    url,
    retryAfter: response.headers.get("retry-after"),
    group: response.headers.get("x-ratelimit-group"),
    remaining: response.headers.get("x-ratelimit-remaining"),
    limit: response.headers.get("x-ratelimit-limit")
  });
  const retryAfter = Number(response.headers.get("retry-after") ?? "1");
  const safeRetryMs = Math.max(1, retryAfter) * 1000;
  await new Promise((resolve) => setTimeout(resolve, safeRetryMs));
  return fetchWithRetry(url, init, retry - 1);
}

export function getAuthorizeUrl(state: string): string {
  const url = new URL(SSO_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", env.eveCallbackUrl);
  url.searchParams.set("client_id", env.eveClientId);
  url.searchParams.set("scope", REQUIRED_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code
  });
  const response = await fetchWithRetry(SSO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: authHeaderValue(),
      "User-Agent": env.userAgent
    },
    body
  });
  return parseJsonResponse<TokenResponse>(response);
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
  const response = await fetchWithRetry(SSO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: authHeaderValue(),
      "User-Agent": env.userAgent
    },
    body
  });
  return parseJsonResponse<TokenResponse>(response);
}

export async function verifyAccessToken(accessToken: string): Promise<VerifyResponse> {
  const response = await fetchWithRetry(SSO_VERIFY_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": env.userAgent
    }
  });
  return parseJsonResponse<VerifyResponse>(response);
}

async function esiRequest<T>(path: string, accessToken: string, init?: RequestInit): Promise<{ data: T; rate: EsiRateInfo }> {
  const response = await fetchWithRetry(`${ESI_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": env.userAgent
    }
  });

  const rate = rateInfoFromHeaders(response.headers);
  try {
    const data = await parseJsonResponse<T>(response);
    return { data, rate };
  } catch (error) {
    if (error instanceof HttpError) {
      throw new HttpError(error.status, error.message, {
        ...(typeof error.data === "object" && error.data ? (error.data as object) : {}),
        rate
      });
    }
    throw error;
  }
}

export async function getFittings(characterId: number, accessToken: string): Promise<EsiFitting[]> {
  const { data } = await esiRequest<EsiFitting[]>(`/characters/${characterId}/fittings/`, accessToken);
  return data;
}

export async function deleteFitting(characterId: number, fittingId: number, accessToken: string): Promise<void> {
  await esiRequest(`/characters/${characterId}/fittings/${fittingId}/`, accessToken, {
    method: "DELETE"
  });
}

export async function createFitting(characterId: number, accessToken: string, fitting: EsiFitting): Promise<number> {
  const { data } = await esiRequest<{ fitting_id: number }>(`/characters/${characterId}/fittings/`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(fitting)
  });
  return data.fitting_id;
}

export async function getCharacterPublicInfo(characterId: number, accessToken: string): Promise<EsiCharacterPublicInfo> {
  const { data } = await esiRequest<EsiCharacterPublicInfo>(`/characters/${characterId}/`, accessToken);
  return data;
}

export async function getCorporationPublicInfo(corporationId: number, accessToken: string): Promise<EsiCorporationPublicInfo> {
  const { data } = await esiRequest<EsiCorporationPublicInfo>(`/corporations/${corporationId}/`, accessToken);
  return data;
}

export async function getAlliancePublicInfo(allianceId: number, accessToken: string): Promise<EsiAlliancePublicInfo> {
  const { data } = await esiRequest<EsiAlliancePublicInfo>(`/alliances/${allianceId}/`, accessToken);
  return data;
}
