# Deployment

This project is designed to be self-hostable anywhere.

## Requirements
- Node runtime that supports Next.js
- Writable volume for `FITS_STORAGE_ROOT`
- Secrets injected via environment variables

## Minimal checklist
- Set `NEXT_PUBLIC_APP_URL`
- Set EVE SSO credentials
- Set `TOKEN_ENCRYPTION_KEY`
- Ensure persistent storage for `./data` (or chosen root)
