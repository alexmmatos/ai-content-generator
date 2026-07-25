import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests hit a real Postgres (via docker-compose) — excluded from the default
    // fast unit-test run, opt in with `npm run test:integration`.
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts"],
  },
});
