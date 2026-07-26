import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.integration.test.ts",
      "**/*.e2e.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      include: ["src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.integration.test.ts",
        "**/*.interface.ts",
        "**/*.type.ts",
        "src/server.ts",
        "src/worker.ts",
        "src/shared/db/prisma.ts",
        "src/features/content-generation/test-utils/**",
        "src/features/content-generation/domain/user.ts",
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
