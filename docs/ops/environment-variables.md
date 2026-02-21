# Environment Variables

Create `.env.local` from `.env.example`.

## Required

| Variable | Example | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | App base URL |
| `EVE_CLIENT_ID` | `abc123` | EVE developer app client id |
| `EVE_CLIENT_SECRET` | `***` | EVE developer app client secret |
| `EVE_CALLBACK_URL` | `http://localhost:3000/api/auth/callback` | OAuth redirect URI (must match developer portal) |
| `TOKEN_ENCRYPTION_KEY` | 32+ chars | Symmetric key for encrypting refresh tokens at rest |
| `FITS_STORAGE_BACKEND` | `local` | Fit storage backend (`local` or `blob`) |
| `FITS_STORAGE_ROOT` | `./data` | Root directory for private server-side fit JSON files |
| `BLOB_READ_WRITE_TOKEN` | `vercel_blob_rw_...` | Required when using blob storage backends |

## Optional

| Variable | Example | Description |
|---|---|---|
| `CACHE_STORAGE_ROOT` | `./.cache/eve-fittings` | Root directory for local cache/session files |
| `SESSION_STORAGE_BACKEND` | `local` | Session storage backend (`local` or `blob`, defaults to `FITS_STORAGE_BACKEND`) |
| `FITS_BLOB_PREFIX` | `fits` | Blob pathname prefix for persisted fittings |
| `SESSION_BLOB_PREFIX` | `sessions` | Blob pathname prefix for sessions |
| `BLOB_JSON_CACHE_TTL_SECONDS` | `300` | In-memory TTL for blob JSON read cache (per process) |
| `BLOB_JSON_CACHE_MAX_ENTRIES` | `1000` | Maximum entries kept in blob JSON read cache (per process) |
| `LOG_LEVEL` | `info` | Logging verbosity (`none`, `debug`, `info`, `warn`, `error`) |
| `SHIP_TYPE_CACHE_TTL_DAYS` | `30` | TTL for EVERef ship type name cache |
| `ESI_USER_AGENT` | `eve-fittings/0.1 (+https://localhost)` | Outbound User-Agent for ESI/SSO requests |
| `SESSION_TTL_HOURS` | `168` | Idle session TTL in hours before session invalidation |
| `SYNC_MIN_INTERVAL_SECONDS` | `300` | Minimum interval between manual `/api/fits/sync` requests per character |
| `JANICE_API_KEY` | `replace-me` | Janice API key used for fitting price lookups |

## Notes
- Never expose secrets via `NEXT_PUBLIC_*`.
- `FITS_STORAGE_ROOT` must not be publicly served.
- `CACHE_STORAGE_ROOT` must not be publicly served.
- Keep storage writable only by the app server process.
