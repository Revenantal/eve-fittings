import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      EVE_CLIENT_ID: "test-client",
      EVE_CLIENT_SECRET: "test-secret",
      EVE_CALLBACK_URL: "http://localhost:3000/api/auth/callback",
      TOKEN_ENCRYPTION_KEY: "12345678901234567890123456789012",
      FITS_STORAGE_ROOT: "./data-test"
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests/server-only.ts")
    }
  }
});
