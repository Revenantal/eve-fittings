# ESI Auth & Scopes

This app uses EVE SSO (OAuth 2.0) to obtain an access token for ESI calls.

## Required scopes
Both scopes are required for the core workflow:
- `esi-fittings.read_fittings.v1`
- `esi-fittings.write_fittings.v1`

## Flow summary
1. User lands on the homepage and clicks the EVE SSO login button.
2. App redirects to EVE SSO with both required scopes.
3. Callback receives an authorization code and exchanges it for `access_token` and `refresh_token`.
4. Server immediately fetches latest fittings from ESI for the authenticated character.
5. Server writes fittings to private on-disk storage and updates latest ESI snapshot metadata.

## Token handling
- Store refresh tokens encrypted at rest.
- Keep tokens server-side only.
- Use an HttpOnly session cookie; never expose tokens to browser JavaScript.

See: [Token storage](../security/token-storage.md).

## User-Agent
All ESI requests should send a clear identifying `User-Agent`.
