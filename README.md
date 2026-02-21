# EVE Fittings

A Next.js app for syncing EVE Online fittings from ESI and storing them as private JSON files on disk.

## Prerequisites

- Node.js 20+
- npm 10+
- An EVE Developer application (for OAuth client ID/secret)

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

Required variables:

- `NEXT_PUBLIC_APP_URL` (example: `http://localhost:3000`)
- `EVE_CLIENT_ID`
- `EVE_CLIENT_SECRET`
- `EVE_CALLBACK_URL` (example: `http://localhost:3000/api/auth/callback`)
- `TOKEN_ENCRYPTION_KEY` (must be 32+ characters)
- `FITS_STORAGE_ROOT` (example: `./data`, used for local fit storage)

Optional variables:

- `FITS_STORAGE_BACKEND` (`local` or `blob`, default `local`)
- `BLOB_READ_WRITE_TOKEN` (required when using blob storage)
- `CACHE_STORAGE_ROOT` (default `./.cache/eve-fittings`, used for cache/session files when local)
- `SESSION_STORAGE_BACKEND` (`local` or `blob`, default follows `FITS_STORAGE_BACKEND`)
- `FITS_BLOB_PREFIX` (default `fits`)
- `SESSION_BLOB_PREFIX` (default `sessions`)
- `BLOB_JSON_CACHE_TTL_SECONDS` (default `300`, in-memory blob JSON read cache TTL per process)
- `BLOB_JSON_CACHE_MAX_ENTRIES` (default `1000`, in-memory blob JSON read cache cap per process)
- `LOG_LEVEL` (`none`, `debug`, `info`, `warn`, or `error`; default `info`)
- `SHIP_TYPE_CACHE_TTL_DAYS` (default `30`)
- `ESI_USER_AGENT` (default `eve-fittings/0.1 (+https://localhost)`)
- `SESSION_TTL_HOURS` (default `168`)
- `SYNC_MIN_INTERVAL_SECONDS` (default `300`)
- `JANICE_API_KEY` (required for Janice price lookups)

## 3. Configure EVE OAuth callback

In the EVE Developer portal, set your app redirect/callback URL to exactly:

- `http://localhost:3000/api/auth/callback`

This must match `EVE_CALLBACK_URL` in `.env.local`.

## 4. Run locally

```bash
npm run dev
```

Open:

- `http://localhost:3000`

Then click **Connect EVE Account** to authorize and sync fittings.

## 5. Verify quality checks

```bash
npm run lint
npm run typecheck
npm test
```

## Available scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run start` - start production server
- `npm run lint` - run ESLint
- `npm run typecheck` - run TypeScript checks
- `npm test` - run test suite
- `npm run test:watch` - run tests in watch mode

## Data storage

By default persisted fittings are written under `./data` (or `FITS_STORAGE_ROOT`):

- One directory per character ID
- One JSON file per fitting
- `index.json` per character for listing/search

Cache/session files are written under `CACHE_STORAGE_ROOT` by default.

For Vercel Serverless, set `FITS_STORAGE_BACKEND=blob` and `SESSION_STORAGE_BACKEND=blob`.

Keep this storage path private and not publicly served.
