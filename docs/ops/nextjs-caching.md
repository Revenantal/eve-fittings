# Next.js Caching Notes (App Router)

Next.js has multiple caching layers (Data Cache, Full Route Cache, Router Cache). By default, it will cache aggressively unless you opt out. citeturn1view4

## Rules of thumb for this app
- ESI calls happen server-side.
- The “Export” action should be dynamic and never served from a stale Full Route Cache.
- The “Browse fits” pages can be cached if they read from disk and you use revalidation on write.

## Recommended patterns
### Server Components for data loading
Prefer reading from disk in Server Components, per Next.js guidance that Server Components can use async I/O such as filesystem reads. citeturn0search19

### When to opt out
For route handlers that return export status or trigger export, set them as dynamic:
- `export const dynamic = "force-dynamic"` (route handlers)
- or use `fetch(..., { cache: "no-store" })` when appropriate

### Revalidation on export
When new fits are written:
- use `revalidatePath("/dashboard")` or tag-based revalidation if you adopt tags.

### `use client`
Use `"use client"` only for interactive UI pieces (buttons, filters). Keep token handling and ESI fetch on the server.
