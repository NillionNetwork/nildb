import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// biome-ignore lint: lib requires default export
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    testTimeout: 0,
    coverage: {
      reporter: ["text", "json-summary", "json"],
      reportOnFailure: true,
    },
  },
});
