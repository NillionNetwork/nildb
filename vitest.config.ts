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
      // Explicitly define source files to analyze for coverage
      include: ["packages/nildb/src/**/*.{js,ts}"],
      // Exclude test files, fixtures, and build artifacts from coverage
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/tests/**",
      ],
    },
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "unit",
          include: ["packages/nildb/tests/01-unit/**/*.test.ts"],
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "integration",
          include: ["packages/nildb/tests/02-integration/**/*.test.ts"],
          globalSetup: "./vitest.global-setup.ts",
        },
      },
    ],
    // These force vitest to run the test suite with 1 worker
    // side-stepping the sequence mismatch issue caused when multiple tests
    // try and share the same nilchain wallet
    // ref: https://github.com/NillionNetwork/nildb/issues/174
    maxWorkers: 1,
  },
});
