import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration.pg.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    maxWorkers: 1,
  },
});
