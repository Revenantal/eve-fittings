# Local Development

## Setup
1. `npm install`
2. `cp .env.example .env.local`
3. Add EVE developer app credentials and callback URL.
4. `npm run dev`

## Data directory
- Fits are stored under `FITS_STORAGE_ROOT` (default `./data`).
- Ensure the directory is writable.
- Add `data/` to `.gitignore`.

## Common issues
- Callback mismatch: ensure `EVE_CALLBACK_URL` matches the app registration.
- 429 rate limit: export less often; see [ESI rate limiting](./esi-rate-limiting.md).
