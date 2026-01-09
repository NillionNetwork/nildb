import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Common test config that apply to all projects
    testTimeout: 0,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reportOnFailure: true,
      reporter: ["text", "json-summary", "json"],
      include: ["packages/api/src/**/*.{js,ts}"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/*.test.js", "**/*.spec.js", "**/tests/**"],
    },
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "unit",
          include: ["packages/api/tests/01-unit/**/*.test.ts"],
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "integration",
          include: ["packages/api/tests/02-integration/**/*.test.ts"],
          globalSetup: "./vitest.global-setup.ts",
        },
      },
    ],
    // Force vitest to run the test suite with 1 worker to avoid nilchain sequence mismatches
    // ref: https://github.com/NillionNetwork/nildb/issues/174
    maxWorkers: 1,
  },
});
