import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/browser-smoke.test.ts"],
    // One Chromium at a time — avoids GA worker OOM/segfault flakes.
    fileParallelism: false,
    maxWorkers: 1,
    pool: "forks",
  },
});
