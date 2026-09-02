import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    // Stale worktree copies of the repo must not run as a second test suite.
    exclude: ["**/node_modules/**", "**/.delta/**", "**/.next/**", "**/out/**"],
  },
});
