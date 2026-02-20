# Testing Strategy

Tests should exist around **all features**.

## Recommended toolset
- Unit/integration: **Vitest**

## What to test
### Unit
- ESI client:
  - builds correct URLs/headers (User-Agent)
  - 429 handling honors `Retry-After`
- Storage:
  - writes manifest + fit JSON deterministically
  - safe path handling (no traversal)
- Transformations:
  - grouping/sorting logic

### Integration
- Route handlers:
  - `/api/auth/*` happy path + error cases
  - `/api/fits/sync` writes expected files and returns summary
  - rate limit behavior (mock 429)

## CI expectations
- `lint` + `typecheck` + tests on every PR
- Coverage threshold (optional): start at 70% and raise over time
