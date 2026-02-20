# Coding Standards (Next.js App Router)

## Server vs Client
- Server Components by default.
- Add `"use client"` only when needed for interactivity.
- Keep ESI calls in server-only modules (`/server` or `/lib/esi` with server-only guard).

## File IO
- All filesystem access is server-only.
- Never accept file paths from user input.
- Prefer atomic writes:
  - write to temp file
  - rename into place
- Maintain per-character `index.json` for fit listings; avoid full directory re-scan per request.
- Use a per-character lock/mutex around sync/remove/import writes to prevent concurrent state races.

## HTTP client (ESI)
- Always include User-Agent per ESI best practices. citeturn1view1
- Honor rate limit headers and `Retry-After`. citeturn1view0
