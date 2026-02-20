# EVE Fit Exporter

Homepage-first flow for EVE fittings:
1. User logs in with EVE SSO.
2. Server fetches `GET /characters/{character_id}/fittings/`.
3. Server stores each fitting at `<FITS_STORAGE_ROOT>/<character_id>/<fitting_id>.json`.
4. UI lists fittings grouped by ship type name (A-Z) with search.
5. UI shows formatted fitting JSON and conditional `Remove from EVE` or `Sync to EVE` actions.

> No database. Storage is private server-side filesystem data.

## Tech stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- EVE SSO + ESI (authenticated)
- EVERef type lookup for ship names

## Quickstart

### Prereqs
- Node.js 18+ (or your org standard)
- A registered EVE developer application (Client ID/Secret)

### Install
```bash
npm install
```

### Configure
```bash
cp .env.example .env.local
```
Fill required variables in [Environment Variables](./ops/environment-variables.md).

### Run
```bash
npm run dev
```

### Tests
```bash
npm test
```

## Repository structure (recommended)
```
/app
  /api
    /auth
    /fits
/components
/lib
  /esi
  /storage
/server
  /auth
  /config
/data               # gitignored: private server-side JSON storage
/docs
```

## Phase 2 candidates
- Multi-character support in one authenticated user session:
  - Character switcher in UI.
  - Per-character token/session handling server-side.
  - API operations scoped to selected `character_id` with authorization checks.

## License / OSS note
This repo is designed to be self-hostable anywhere. Avoid hard-coding vendor-specific deployment assumptions.
