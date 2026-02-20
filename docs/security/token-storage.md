# Token Storage (No Database)

## Why this matters
Refresh tokens effectively grant long-lived access. Treat them like passwords.

## Recommended approach for OSS + self-hosting
- Store refresh tokens server-side **on disk**, encrypted with `TOKEN_ENCRYPTION_KEY`.
- Store only a short session identifier in a HttpOnly cookie.
- When a request needs ESI, decrypt refresh token server-side and mint an access token.

## Where to store on disk
Extend the on-disk layout:
```
data/
  sessions/
    <sessionId>.json   # encrypted refresh token, character id, createdAt
```

## Cookie settings
- `HttpOnly`, `Secure` in production, `SameSite=Lax` (typical)
- Short TTL; rotate session IDs as needed

## Incident response
If `TOKEN_ENCRYPTION_KEY` is leaked:
- rotate the key
- invalidate all sessions (delete `data/sessions/*`)
