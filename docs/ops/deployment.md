# Deployment

This project is designed to be self-hostable anywhere.

## Requirements
- Node runtime that supports Next.js
- Secrets injected via environment variables
- If `FITS_STORAGE_BACKEND=local`, writable persistent volume for `FITS_STORAGE_ROOT`
- If `SESSION_STORAGE_BACKEND=local`, writable volume for `CACHE_STORAGE_ROOT`
- If using blob backends, `BLOB_READ_WRITE_TOKEN`

## Minimal checklist
- Set `NEXT_PUBLIC_APP_URL`
- Set EVE SSO credentials
- Set `TOKEN_ENCRYPTION_KEY`
- Choose `FITS_STORAGE_BACKEND` and `SESSION_STORAGE_BACKEND`
- If local storage is used, ensure persistent storage for configured local roots
