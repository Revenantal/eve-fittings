# Linting & Formatting

## Recommended
- ESLint (Next.js)
- Prettier
- TypeScript strict

## Suggested scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```
