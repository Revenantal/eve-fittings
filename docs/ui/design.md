# UI Design Notes (EVE-inspired, Tailwind Dark)

## Inspiration
- Use EVE Online’s dark, high-contrast UI feel: deep greys, subtle borders, compact typography.
- Prefer “panel” layouts (cards with headers, tables/list rows).

## Components (suggested)
- Top nav: app title + character chip + export button
- Left sidebar: ship groups (optional)
- Main content: fit list and fit details
- Fit details: modules list, charges, drones (as present), plus raw JSON panel

## Notifications
- Use toast-style notifications for user feedback.
- Show toasts for success, errors, and stale-data warnings after refresh failures.

## Images
Use EVE Image Server for ships/types. citeturn1view2
- `types/{typeId}/render?size=256`
- fallback to `types/{typeId}/icon?size=64`

## Icons
If needed, use `react-icons` for UI affordances.
