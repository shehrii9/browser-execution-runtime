import { defineConfig } from "vitest/config";

/** better-sqlite3 can segfault under vitest threads on some Linux CI runners. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/experience.test.ts", "tests/experience-softmatch.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
    maxWorkers: 1,
  },
});
