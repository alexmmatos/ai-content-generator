import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      include: [
        "src/app.ts",
        "src/routes/**/*.ts",
        "src/schemas/**/*.ts",
        "src/services/**/*.ts",
        "src/repositories/**/*.ts",
        "src/lib/upload-content-file.ts",
        "src/workers/process-content-generation-job.ts",
        "src/workers/should-mark-failed.ts",
        "src/workers/simulate-ai-call.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.integration.test.ts"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
