# ESI Rate Limiting

ESI uses a **bucket + token** rate limiting model. Each route belongs to a rate limit group and each *user* has their own bucket keyed by route group + userID. citeturn1view0

## Token costs
Each request consumes tokens based on status code: citeturn1view0
- 2xx: 2 tokens
- 3xx: 1 token
- 4xx: 5 tokens (except 429)
- 5xx: 0 tokens

## Headers you must watch
Responses include: citeturn1view0
- `X-Ratelimit-Group`
- `X-Ratelimit-Limit` (e.g. `150/15m`)
- `X-Ratelimit-Remaining`
- `X-Ratelimit-Used`

If you exceed the limit, you receive:
- `429` and a `Retry-After` header (seconds until you can try again). citeturn1view0

## Implementation guidance
- Centralize HTTP calls through a single ESI client so the retry/backoff behavior is consistent.
- On 429:
  - read `Retry-After`
  - pause and retry (server-side only)
  - return a friendly UI message if the wait is long
- Avoid generating 4xx errors (they cost more tokens). Validate inputs before calling ESI. citeturn1view0

## Practical default behavior (suggested)
- Max 1 export per character per ~60s (soft limit in UI)
- Exponential backoff with cap, but always respect `Retry-After` if present
