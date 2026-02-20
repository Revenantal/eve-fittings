# API Surface (Route Handlers)

Paths are suggestions and should remain server-authenticated.

## Auth
- `GET /api/auth/login`
  - Redirect to EVE SSO authorize URL with required scopes.
  - Emits structured log event: `oauth_login_redirect`.
- `GET /api/auth/callback`
  - Exchange code for tokens.
  - Persist encrypted refresh token.
  - Set session cookie.
  - Trigger initial ESI fittings sync.
  - On success: `307` redirect to `/`.
  - On invalid callback params/state: `400`.
  - On token exchange/verify failures: `500`.
- `POST /api/auth/logout`
  - Clear session cookie.
  - Optionally revoke/delete stored token material.
  - Requires valid CSRF header (`x-csrf-token`).
- `GET /api/profile`
  - Return character profile data for the authenticated session.
  - Includes character name, corporation name, alliance name (`null` allowed), and portrait URL.

## Fits
- `POST /api/fits/sync`
  - Fetch latest fittings from ESI for current session character.
  - Persist files to `<FITS_STORAGE_ROOT>/<character_id>/<fitting_id>.json`.
  - Update `<FITS_STORAGE_ROOT>/<character_id>/index.json` atomically.
  - Keep files indefinitely (no auto-prune).
  - Return summary (count, syncedAt).
  - Requires valid CSRF header (`x-csrf-token`).
  - Enforces per-character throttle window via `SYNC_MIN_INTERVAL_SECONDS`.
  - Returns `429` with `{ details: { retryAfterSeconds } }` when throttled.
- `GET /api/fits`
  - Return fitting list grouped by ship type name (alphabetical).
  - Use per-character `index.json` for list/search performance.
  - Include local stored fittings and mark each fitting with sync status from latest ESI index.
  - Include ship name resolved via cached EVERef type lookup.
  - Support fuzzy search by fitting name via query text parameter.
  - Clients should debounce search requests (recommended 200-300ms).
- `GET /api/fits/{fitting_id}`
  - Return stored fitting JSON.
  - Return action availability from latest ESI state (`canRemoveFromEve`, `canSyncToEve`).
  - Include fitting header metadata (`shipTypeId`, `shipTypeName`, `fittingName`) for UI display.
- `GET /api/fits/{fitting_id}/pyfa`
  - Return server-rendered PYFA text format for the stored fitting.
  - Groups modules by slots and includes drones/cargo quantities.
- `DELETE /api/fits/{fitting_id}`
  - Permanently delete a locally stored fitting JSON file.
  - Also removes the fitting from local `index.json` if present.
  - Requires valid CSRF header (`x-csrf-token`).
- `POST /api/fits/{fitting_id}/remove`
  - Require explicit user confirmation intent from the client flow before execution.
  - Remove fitting from EVE.
  - Refresh ESI data and local files before returning.
- `POST /api/fits/{fitting_id}/sync`
  - Sync local fitting JSON into EVE exactly as stored.
  - Refresh ESI data and local files before returning.

## Ship type cache
- `GET https://ref-data.everef.net/types/{ship_type_id}`
  - Resolve ship type name from `name.en` or equivalent canonical display field.
  - Cache by `ship_type_id` using `SHIP_TYPE_CACHE_TTL_DAYS` (default `30`).

## Principles
- Never accept `character_id` from client as authority; derive from authenticated session.
- Validate all params and payloads.
- Handle ESI rate limiting and token refresh server-side.
- Never expose filesystem paths in API responses.
- If post-mutation refresh fails, return mutation result plus a stale-data flag so UI can warn users.
- Serialize writes with a per-character lock for sync/remove/import operations.
- Include/propagate `x-request-id` for server log correlation.

## Example Responses
- `POST /api/fits/sync` success (`200`):
```json
{
  "count": 14,
  "syncedAt": "2026-02-20T03:10:00.000Z"
}
```
- `POST /api/fits/sync` throttled (`429`):
```json
{
  "error": "Sync recently requested. Please retry shortly.",
  "details": {
    "retryAfterSeconds": 42
  }
}
```
- `GET /api/profile` success (`200`):
```json
{
  "characterId": 1337,
  "characterName": "Pilot",
  "corporationName": "Acme Corp",
  "allianceName": null,
  "portraitUrl": "https://images.evetech.net/characters/1337/portrait?size=128"
}
```
- `POST /api/fits/{fitting_id}/remove` stale refresh (`200`):
```json
{
  "removed": true,
  "stale": true
}
```
- `POST /api/fits/{fitting_id}/sync` stale refresh (`200`):
```json
{
  "synced": true,
  "newFittingId": 123456,
  "stale": true
}
```
