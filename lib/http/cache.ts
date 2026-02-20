export const PRIVATE_CACHE_15_MIN_HEADERS = {
  "Cache-Control": "private, max-age=900, stale-while-revalidate=60",
  Vary: "Cookie"
} as const;

export const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie"
} as const;
