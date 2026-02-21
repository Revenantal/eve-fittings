# Security

## Principles
- Server-only secrets (client secret, token encryption key).
- Least-privilege filesystem permissions for `FITS_STORAGE_ROOT`.
- Least-privilege filesystem permissions for `CACHE_STORAGE_ROOT` when using local caches/sessions.
- Fitting JSON files are private server data and must never be publicly reachable.

## ESI / SSO
- Require scopes:
  - `esi-fittings.read_fittings.v1`
  - `esi-fittings.write_fittings.v1`
- Keep tokens server-side only.
- Send identifying `User-Agent` and handle ESI rate limiting.

## Storage hardening
- Do not place `FITS_STORAGE_ROOT` under `public/` or any static assets directory.
- Do not place `CACHE_STORAGE_ROOT` under `public/` or any static assets directory.
- Block direct HTTP access to any storage directory.
- Normalize and validate all constructed paths to prevent path traversal.

## Web security
- Authenticate every fit read/write/import/remove route.
- Authorize by session character id.
- Protect state-changing routes against CSRF if cookie-authenticated.
- Avoid leaking fit contents or character ids across sessions.
