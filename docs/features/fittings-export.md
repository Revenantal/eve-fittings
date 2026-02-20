# Fittings Export & Storage

## Source of truth
On successful login, the server fetches fittings from ESI for the authenticated character:
- `GET /characters/{character_id}/fittings/`

This ESI response is the source of truth for whether a fitting currently exists in EVE.

## Storage format
Persist each fitting as a separate JSON file:
- `<FITS_STORAGE_ROOT>/<character_id>/<fitting_id>.json`
- `<FITS_STORAGE_ROOT>/<character_id>/index.json` for listing/search metadata.

The raw fitting JSON should be written as received and preserved as-is.

## Retention policy
- Keep fitting JSON files indefinitely by default.
- Do not auto-prune old fitting files.

## Performance guardrails
- Do not scan and parse all fitting JSON files on every list request.
- Use `index.json` as the primary source for list/search/group rendering.
- Rebuild/update `index.json` only during sync and fitting mutation workflows.

## Security requirement
These files must never be publicly accessible:
- Store under a server-only directory.
- Never serve this directory via static file routing.
- Enforce strict filesystem permissions.

See: [On-disk layout](../data/on-disk-layout.md) and [Security](../security/security.md).

## Ship type naming and grouping
The left panel groups fittings by ship type name (alphabetical).

Ship type name lookup uses:
- `https://ref-data.everef.net/types/{ship_type_id}`

Cache ship type name lookups using `SHIP_TYPE_CACHE_TTL_DAYS` (default `30`).

## UI behavior
- Left panel:
  - Group by ship type name (A-Z).
  - Search fittings by name using fuzzy (typo-tolerant) matching.
  - Debounce search input (recommended default: 200-300ms).
- Right panel:
  - Render selected fitting JSON in a formatted, color-coded view.

## Conditional fitting actions
At the top of the fitting detail panel:
- Show `Remove from EVE` when the latest ESI sync includes this fitting id.
- Show `Sync to EVE` when the latest ESI sync does not include this fitting id.
- Require a confirmation step before `Remove from EVE` executes.

After either action completes, refresh ESI data and update local files before re-rendering action state.

## Refresh failure behavior
Use the last known local state and display a clear "data may be stale" warning if post-action ESI refresh fails.
