# Architecture Overview

## Goals
- Export fittings via ESI and store as JSON (filesystem or Blob).
- Minimal client JavaScript; Server Components by default.
- Respect ESI rate limiting and caching semantics.
- Easy self-hosting (no DB required).

## High-level components
1. **Auth**: EVE SSO (OAuth 2.0 authorization code flow).
2. **ESI client**: server-only HTTP client to call ESI routes.
3. **Storage**: backend-based JSON persistence (`local` or `blob`).
4. **UI**: dashboard to browse fits by ship type + fit name.

## Request flow
### Login
1. User clicks “Connect EVE”.
2. App redirects to EVE SSO authorize.
3. Callback exchanges code for tokens.
4. Store refresh token encrypted at rest; set a session cookie.

### Export fits
1. User clicks “Export”.
2. Server calls ESI GET fittings for that character.
3. Server normalizes and writes JSON files.
4. UI shows latest export timestamp + browsing list.

## Next.js best practices
- Prefer **Server Components** for pages and data loading.
- Use `"use client"` only for:
  - interactive controls (buttons, filters)
  - local UI state
- Keep secrets and token handling server-only.
- Use Next.js caching APIs intentionally (see [Caching notes](../ops/nextjs-caching.md)).

## Data storage strategy (no DB)
- Persisted fits stored under `FITS_STORAGE_ROOT` (default `./data`) or Blob (`FITS_BLOB_PREFIX`).
- One folder/prefix per character ID.
- One JSON per fitting plus an index manifest.
- Local caches and local sessions stored under `CACHE_STORAGE_ROOT` (default `./.cache/eve-fittings`).

See: [On-disk layout](../data/on-disk-layout.md).
