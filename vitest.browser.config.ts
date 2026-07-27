import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/browser-smoke.test.ts"],
    maxWorkers: 1,
    fileParallelism: false,
  },
});
