# Local Development

## Setup
1. `npm install`
2. `cp .env.example .env.local`
3. Add EVE developer app credentials and callback URL.
4. `npm run dev`

## Data directory
- Fits are stored under `FITS_STORAGE_ROOT` (default `./data`).
- Caches/sessions are stored under `CACHE_STORAGE_ROOT` (default `./.cache/eve-fittings`) when local backends are enabled.
- Ensure local storage directories are writable.
- Add `data/` and `.cache/` to `.gitignore`.

## Common issues
- Callback mismatch: ensure `EVE_CALLBACK_URL` matches the app registration.
- 429 rate limit: export less often; see [ESI rate limiting](./esi-rate-limiting.md).
