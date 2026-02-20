# Troubleshooting

## I get rate limited (429)
- ESI returns `429` with `Retry-After` (seconds). citeturn1view0
- Wait the requested time and retry.
- Avoid repeated invalid requests (4xx cost more tokens). citeturn1view0

## Images not loading
- Verify you are using `https://images.evetech.net/...` format. citeturn1view2
- Ensure the `size` parameter is a power of two between 32 and 1024. citeturn1view2

## OAuth callback errors
- Ensure callback URL in `.env.local` matches the EVE dev portal registration.
