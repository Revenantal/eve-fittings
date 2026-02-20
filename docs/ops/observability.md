# Observability

## Logging
- Use structured logs (JSON) server-side.
- Include request ID and character ID (if available), but never tokens.
- Support inbound `x-request-id`; generate one when absent.

## Useful events
- OAuth success/failure
- Export started/completed
- Rate limit encountered (include headers, not secrets)
- Session/logout events (`logout_success`, CSRF rejections)
- Fit mutation stale refresh events (remove/sync with stale=true)
