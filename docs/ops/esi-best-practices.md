# ESI Best Practices (Quick Notes)

## User-Agent
ESI best practices recommend including identifying info (email/app name+version/repo URL, etc.). citeturn1view1

## Avoid errors
4xx responses cost more tokens in rate limiting. Validate inputs and avoid spamming invalid calls. citeturn1view0

## Use caching headers
ESI routes are grouped and rate-limited; use `If-None-Match`/`If-Modified-Since` when you later expand to endpoints that support them to reduce token use (3xx is cheaper). citeturn1view0
