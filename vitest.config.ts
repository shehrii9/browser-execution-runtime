import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: [
      "tests/browser-smoke.test.ts",
      "tests/experience.test.ts",
      "tests/experience-softmatch.test.ts",
    ],
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
  },
});
