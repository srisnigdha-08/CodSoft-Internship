import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Every test file shares the one dedicated test database.
    fileParallelism: false,
  },
});
