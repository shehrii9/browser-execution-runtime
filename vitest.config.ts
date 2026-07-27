import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/browser-smoke.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
  },
});
