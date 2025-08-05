import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globalSetup: "./vitest.global-setup.ts",
    setupFiles: ["./tests/fixture/test-setup.ts"],
    testTimeout: 0,
    env: {
      DEBUG: "@nillion*",
    },
    coverage: {
      reporter: ["text", "json-summary", "json"],
      reportOnFailure: true,
    },
    // These force vitest to run the test suite with 1 worker
    // side-stepping the sequence mismatch issue caused when multiple tests
    // try and share the same nilchain wallet
    // ref: https://github.com/NillionNetwork/nildb/issues/174
    maxWorkers: 1,
    minWorkers: 1,
  },
});
