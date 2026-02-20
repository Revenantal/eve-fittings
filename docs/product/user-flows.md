# User Flows

## Flow: Connect EVE Account
1. User opens homepage.
2. User clicks the EVE SSO login button.
3. User authenticates and approves required scopes.
4. Server receives callback and creates authenticated session.
5. Server immediately syncs fittings from ESI and writes local JSON files.
6. User is redirected to fitting browser UI.

## Flow: Browse fittings
1. Left panel shows groups by ship type name (A-Z).
2. User can search fittings by name with fuzzy (typo-tolerant) matching.
3. Search runs after a short debounce window.
4. User selects a fitting.
5. Right panel renders formatted, color-coded JSON for that fitting.

## Flow: Remove fitting from EVE
1. User opens fitting detail.
2. If fitting id exists in latest ESI sync, show `Remove from EVE`.
3. User clicks `Remove from EVE`.
4. UI prompts for confirmation.
5. Server calls ESI delete for that fitting id.
6. Server refreshes ESI data and local JSON files.
7. UI refreshes with updated action state.
8. UI shows a toast notification for success or failure.

## Flow: Sync fitting to EVE
1. User opens fitting detail.
2. If fitting id is absent from latest ESI sync, show `Sync to EVE`.
3. User clicks `Sync to EVE`.
4. Server sends stored fitting JSON to ESI write endpoint exactly as saved.
5. Server refreshes ESI data and local JSON files.
6. UI refreshes with updated action state.
7. UI shows a toast notification for success or failure.

## Flow: Refresh failure after remove/sync
1. Mutation succeeds but post-action ESI refresh fails.
2. UI keeps last known local data rendered.
3. UI shows a warning that ESI refresh failed and data may be stale.
4. UI also shows a warning toast with a retry suggestion.

## Phase 2 note
Current scope is single-character per authenticated session. A future phase may support multiple connected characters with a character switcher and character-scoped API actions.
