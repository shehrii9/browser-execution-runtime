import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/browser-smoke.test.ts"],
    // better-sqlite3 is a native addon; worker threads can segfault on Linux CI.
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
  },
});
