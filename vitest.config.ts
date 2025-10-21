import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Common test config that applies to all projects
    testTimeout: 0,
    hookTimeout: 30000,
    env: {
      DEBUG: "@nillion*",
    },
    coverage: {
      reporter: ["text", "json-summary", "json"] as const,
      reportOnFailure: true,
    },
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "unit",
          include: ["tests/01-unit/**/*.test.ts"],
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "integration",
          include: ["tests/02-integration/**/*.test.ts"],
          globalSetup: "./vitest.global-setup.ts",
        },
      },
    ],
    // These force vitest to run the test suite with 1 worker
    // side-stepping the sequence mismatch issue caused when multiple tests
    // try and share the same nilchain wallet
    // ref: https://github.com/NillionNetwork/nildb/issues/174
    maxWorkers: 1,
    minWorkers: 1,
  },
});
