# On-disk Layout (No Database)

Root directory: `FITS_STORAGE_ROOT` (default `./data`)

```
data/
  <character_id>/
    index.json
    <fitting_id>.json
  _cache/
    ship-types/
      <ship_type_id>.json
```

## Character fitting file
Path:
- `<FITS_STORAGE_ROOT>/<character_id>/<fitting_id>.json`

Contents:
- Raw fitting JSON payload used for rendering and re-sync actions.

## Character index file
Path:
- `<FITS_STORAGE_ROOT>/<character_id>/index.json`

Purpose:
- Fast listing/search/grouping without re-reading every fitting file on each request.

Recommended fields:
- `characterId`
- `updatedAt`
- `fittings`: array of lightweight records (`fittingId`, `name`, `shipTypeId`, `path`)

## Write safety
- Use atomic writes for both fitting files and `index.json`:
  - write to a temporary file in the same directory
  - `rename` to the final filename
- Use a per-character write lock so concurrent sync/mutation requests cannot corrupt index state.

## Ship type cache file
Path:
- `<FITS_STORAGE_ROOT>/_cache/ship-types/<ship_type_id>.json`

Recommended fields:
- `shipTypeId`
- `shipTypeName`
- `cachedAt`
- `expiresAt`

Default TTL: 30 days (override with `SHIP_TYPE_CACHE_TTL_DAYS`).

## Security requirements
- Keep `FITS_STORAGE_ROOT` outside public static serving paths.
- Disallow directory listing and direct HTTP reads.
- Grant read/write only to the server runtime identity.

## Git
Add `data/` to `.gitignore` by default.
