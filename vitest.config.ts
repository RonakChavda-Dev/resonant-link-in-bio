import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for pure modules (validation, security helpers, editor state).
// Kept separate from vite.config.ts so tests don't boot the Workers runtime.
export default defineConfig({
  resolve: { alias: { "~": fileURLToPath(new URL("./app", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
